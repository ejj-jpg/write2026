import confetti from 'canvas-confetti';
import { Badge, StudentGrowth, WritingRecord } from '../types';

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  icon: string;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: '새싹 작가', minXp: 0, maxXp: 99, icon: '🌱' },
  { level: 2, title: '꿈꾸는 작가', minXp: 100, maxXp: 249, icon: '⭐' },
  { level: 3, title: '돋보기 작가', minXp: 250, maxXp: 449, icon: '🔍' },
  { level: 4, title: '생각나무 작가', minXp: 450, maxXp: 699, icon: '🌳' },
  { level: 5, title: '별빛 문장가', minXp: 700, maxXp: 999, icon: '✨' },
  { level: 6, title: '이야기 탐험가', minXp: 1000, maxXp: 1399, icon: '🧭' },
  { level: 7, title: '마법 펜 작가', minXp: 1400, maxXp: 1899, icon: '🪄' },
  { level: 8, title: '지혜의 작가', minXp: 1900, maxXp: 2499, icon: '🦉' },
  { level: 9, title: '황금 만년필 대작가', minXp: 2500, maxXp: 999999, icon: '👑' }
];

export const AVAILABLE_AVATARS = [
  { id: 'sprout', name: '초록 새싹이', emoji: '🌱', requiredLevel: 1 },
  { id: 'cat', name: '호기심 냥이', emoji: '🐱', requiredLevel: 1 },
  { id: 'rabbit', name: '꿈꾸는 토끼', emoji: '🐰', requiredLevel: 2 },
  { id: 'bear', name: '듬직 곰돌이', emoji: '🐻', requiredLevel: 3 },
  { id: 'owl', name: '지혜 부엉이', emoji: '🦉', requiredLevel: 4 },
  { id: 'fox', name: '생각 여우', emoji: '🦊', requiredLevel: 5 },
  { id: 'dragon', name: '상상 아기용', emoji: '🐲', requiredLevel: 6 }
];

export const BADGE_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (records: WritingRecord[], currentGrowth: StudentGrowth) => boolean;
}> = [
  {
    id: 'first_plan',
    name: '첫 생각의 씨앗',
    description: '처음으로 글쓰기 계획을 멋지게 세웠어요!',
    icon: '📝',
    check: (records) => records.some(r => r.planning?.title && r.planning?.title.trim().length > 0)
  },
  {
    id: 'first_submission',
    name: '나의 첫 완성작',
    description: '고쳐쓰기와 맞춤법 점검을 거쳐 첫 글을 완성했어요!',
    icon: '🏆',
    check: (records) => records.some(r => r.status === 'submitted')
  },
  {
    id: 'thoughtful_reviser',
    name: '꼼꼼한 다듬이',
    description: 'AI 피드백을 깊이 생각하고 고쳐쓰기를 정성껏 해냈어요.',
    icon: '💎',
    check: (records) => records.some(r => r.revisionGoal && r.revisionGoal.trim().length >= 10 && (r.revisedWriting || '').length > 50)
  },
  {
    id: 'spelling_master',
    name: '맞춤법 탐정',
    description: '맞춤법과 띄어쓰기를 꼼꼼히 점검하고 바로잡았어요.',
    icon: '🔍',
    check: (records) => records.some(r => r.proofreadSuggestions && r.proofreadSuggestions.length > 0)
  },
  {
    id: 'self_reflection_star',
    name: '스스로 비추는 거울',
    description: '자기평가에서 자신의 글을 솔직하고 깊이 있게 돌아봤어요.',
    icon: '🌟',
    check: (records) => records.some(r => r.selfAssessment?.selfThoughts && r.selfAssessment.selfThoughts.trim().length >= 15)
  },
  {
    id: 'streak_3',
    name: '꾸준한 글쓰기 친구',
    description: '3편 이상의 멋진 작품을 완성하여 제출했어요!',
    icon: '📚',
    check: (records) => records.filter(r => r.status === 'submitted').length >= 3
  },
  {
    id: 'streak_5',
    name: '열정의 작가왕',
    description: '5편 이상의 다채로운 글을 꾸준히 썼어요!',
    icon: '🎖️',
    check: (records) => records.filter(r => r.status === 'submitted').length >= 5
  }
];

export function calculateLevel(xp: number): LevelInfo {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

export function checkNewBadges(records: WritingRecord[], growth: StudentGrowth): Badge[] {
  const existingIds = new Set((growth.badges || []).map(b => (typeof b === 'string' ? b : b?.id)));
  const newBadges: Badge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    if (!existingIds.has(def.id) && def.check(records, growth)) {
      newBadges.push({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        unlockedAt: Date.now()
      });
    }
  }
  return newBadges;
}

export function triggerCelebration(type: 'level_up' | 'badge' | 'submit') {
  try {
    if (type === 'level_up') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else if (type === 'badge') {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#F59E0B', '#10B981', '#6366F1']
      });
    } else {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  } catch (e) {
    // Canvas confetti might fail if canvas is not ready
  }
}

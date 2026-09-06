import { DailyTopic, AiFeedbackData, ProofreadSuggestion, WritingPlanning, WritingRecord, StoryIdeaSuggestion, StoryFramework } from '../types';

export interface GeminiTestResult {
  success: boolean;
  message: string;
  model?: string;
  error?: string;
  latencyMs: number;
}

export const PRESET_TOPICS: DailyTopic[] = [
  {
    id: 'preset_1',
    title: '내 인생 가장 떨렸던 순간',
    category: '경험 글쓰기',
    targetGrade: 4,
    description: '처음 무대에 올랐거나, 전학을 왔거나, 시험을 봤던 날처럼 가슴이 콩닥콩닥 뛰었던 순간을 떠올려 보세요.',
    guideQuestions: [
      '어떤 일 때문에 가슴이 그렇게 떨렸나요?',
      '그때 내 표정과 몸짓, 숨소리는 어땠나요?',
      '그 일이 끝난 뒤 내 마음에는 어떤 생각이 남았나요?'
    ],
    isPreset: true,
    createdAt: 1700000000000
  },
  {
    id: 'preset_2',
    title: '만약 우리 학교에 투명인간이 다닌다면?',
    category: '상상 글쓰기',
    targetGrade: 4,
    description: '교실 문이 저절로 열리고 칠판 글씨가 혼자 써진다면? 기발하고 엉뚱한 상상을 펼쳐보세요.',
    guideQuestions: [
      '투명인간 친구는 학교에서 무엇을 하고 있을까요?',
      '그 친구와 나만의 비밀 신호를 만든다면?',
      '투명인간과 함께 힘을 합쳐 해결하고 싶은 일은 무엇인가요?'
    ],
    isPreset: true,
    createdAt: 1700000000000
  },
  {
    id: 'preset_3',
    title: '내가 가장 아끼는 보물 1호 이야기',
    category: '설명·생활문',
    targetGrade: 3,
    description: '낡은 인형, 친구가 준 쪽지, 아끼는 책 등 나에게 특별한 의미가 있는 소중한 물건을 소개해 주세요.',
    guideQuestions: [
      '이 물건은 어떻게 나에게 오게 되었나요?',
      '이 물건과 얽힌 특별한 추억은 무엇인가요?',
      '이 보물에게 전하고 싶은 한마디는 무엇인가요?'
    ],
    isPreset: true,
    createdAt: 1700000000000
  },
  {
    id: 'preset_4',
    title: '스마트폰 사용 시간, 스스로 줄일 수 있을까?',
    category: '주장하는 글',
    targetGrade: 5,
    description: '우리 일상에서 꼭 필요하지만 때로는 고민이 되는 스마트폰에 대해 나의 생각을 솔직하게 밝혀보세요.',
    guideQuestions: [
      '내가 생각하는 스마트폰의 가장 좋은 점과 힘든 점은 무엇인가요?',
      '스스로 올바르게 쓰기 위한 나만의 약속이나 규칙은 무엇일까요?',
      '친구들에게 권하고 싶은 지혜로운 사용법은 무엇인가요?'
    ],
    isPreset: true,
    createdAt: 1700000000000
  }
];

export async function testGeminiConnection(): Promise<GeminiTestResult> {
  const startTime = performance.now();

  // Try endpoints with cache-busting to prevent stale 404 browser cache
  const candidateUrls = [
    `/api/gemini/test?_t=${Date.now()}`,
    `/api/gemini/test/?_t=${Date.now()}`,
    `/gemini/test?_t=${Date.now()}`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        body: JSON.stringify({ ping: true, timestamp: Date.now() })
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: data.message || 'Gemini AI 연결이 정상 작동 중입니다.',
          model: data.model,
          latencyMs
        };
      }

      // If server returned non-404 error (e.g. 500), parse the message directly
      if (res.status !== 404) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errData.error || `서버 응답 오류 (${res.status})`,
          error: errData.error || `HTTP ${res.status}`,
          latencyMs
        };
      }
    } catch {
      // Continue to next endpoint attempt
    }
  }

  // If all POST attempts failed with 404 or network issue, probe /api/health
  try {
    const healthRes = await fetch(`/api/health?_t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      const latencyMs = Math.round(performance.now() - startTime);
      if (healthData.hasGeminiKey) {
        return {
          success: true,
          message: `서버 및 Gemini 키 설정 정상 확인됨 (모델: ${healthData.candidateModels?.[0] || 'gemini-3.1-flash-lite'})`,
          model: healthData.candidateModels?.[0],
          latencyMs
        };
      }
      return {
        success: false,
        message: '서버는 정상 구동 중이나 GEMINI_API_KEY 환경변수가 비어 있습니다.',
        latencyMs
      };
    }
  } catch (healthErr: any) {
    console.warn('Health probe error:', healthErr);
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return {
    success: false,
    message: '서버 연결 실패. 개발 서버가 시작 중일 수 있으니 잠시 후 다시 테스트해주세요.',
    latencyMs
  };
}

export async function requestAITopics(grade: number, category: string, keywords: string = ''): Promise<DailyTopic[]> {
  try {
    const res = await fetch(`/api/gemini/topics?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify({ grade, category, keywords })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '주제 생성 실패');
    }

    const data = await res.json();
    if (Array.isArray(data.topics) && data.topics.length > 0) {
      return data.topics.map((t: any, idx: number) => ({
        id: `ai_${Date.now()}_${idx}`,
        title: t.title || '재미있는 글쓰기',
        category: t.category || category,
        targetGrade: grade,
        description: t.description || '',
        guideQuestions: Array.isArray(t.guideQuestions) ? t.guideQuestions : [],
        createdAt: Date.now()
      }));
    }
    return PRESET_TOPICS;
  } catch (err) {
    console.warn('AI topics generation failed, using preset topics fallback:', err);
    return PRESET_TOPICS;
  }
}

export async function requestDraftFeedback(
  topicTitle: string,
  draft: string,
  planning: WritingPlanning,
  grade: number = 4
): Promise<AiFeedbackData> {
  const res = await fetch(`/api/gemini/feedback?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    },
    cache: 'no-store',
    body: JSON.stringify({ topicTitle, draft, planning, grade })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '피드백 생성 중 오류가 발생했습니다.');
  }

  const data = await res.json();
  return data.feedback;
}

export async function requestProofreading(
  text: string,
  grade: number = 4
): Promise<{
  beforeProofreading: string;
  afterProofreading: string;
  suggestions: ProofreadSuggestion[];
}> {
  const res = await fetch(`/api/gemini/proofread?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    },
    cache: 'no-store',
    body: JSON.stringify({ text, grade })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '맞춤법 점검 중 오류가 발생했습니다.');
  }

  const data = await res.json();
  return {
    beforeProofreading: data.beforeProofreading || text,
    afterProofreading: data.afterProofreading || text,
    suggestions: (data.suggestions || []).map((s: any, idx: number) => ({
      id: s.id || `sug_${idx}`,
      original: s.original || '',
      corrected: s.corrected || '',
      type: s.type || '맞춤법',
      reason: s.reason || '어법에 맞게 수정',
      applied: false
    }))
  };
}

export async function requestProcessAssessmentDraft(
  studentName: string,
  grade: number,
  record: WritingRecord
): Promise<string> {
  const res = await fetch(`/api/gemini/process-assessment?_t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    },
    cache: 'no-store',
    body: JSON.stringify({ studentName, grade, record })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '과정중심평가 초안 생성 실패');
  }

  const data = await res.json();
  return data.aiAssessmentDraft || '';
}

// Helper to extract keywords and entities from a Korean sentence for client-side dynamic seeds
function extractSentenceEntities(sentence: string = ''): {
  subject: string;
  placeOrObject: string;
  action: string;
  keywords: string[];
} {
  const clean = (sentence || '').replace(/[.!?,"'“”‘’]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(w => w.length >= 2);
  const stopWords = new Set(['내가', '나는', '어느', '날에', '그때', '갑자기', '정말', '너무', '매우', '그리고', '하지만', '있었다', '했다', '보았다', '되었다', '나의', '우리']);
  const meaningful = words.filter(w => !stopWords.has(w));

  const subject = meaningful[0] || (words[0] || '주인공');
  const placeOrObject = meaningful[1] || meaningful[0] || '신비한 공간';
  const action = meaningful.slice(2).join(' ') || '특별한 일';

  return {
    subject,
    placeOrObject,
    action,
    keywords: meaningful.slice(0, 5)
  };
}

export const DIVERSE_OPENINGS: StoryIdeaSuggestion[] = [
  {
    id: 'open_1',
    title: '서랍 속 황금문',
    description: '책상 서랍 구석에서 은은한 빛과 함께 열리는 신비로운 오프닝이에요.',
    preview: '숙제를 하려고 책상 서랍을 연 순간, 서랍 안쪽 구석에서 딸깍 소리와 함께 손톱만 한 황금색 문이 스르륵 열렸다.'
  },
  {
    title: '말하는 파란 운동화',
    id: 'open_2',
    description: '아침에 신발을 신으려는데 운동화가 말을 거는 유쾌한 오프닝이에요.',
    preview: '현관문을 나서려는데 신발장에 놓인 파란 운동화가 끄응 하품을 하더니 "오늘은 제발 흙탕물에 들어가지 마!"라고 소리쳤다.'
  },
  {
    title: '냉장고 속 아기 북극곰',
    id: 'open_3',
    description: '한여름 냉장고 안에서 만난 털북숭이 친구의 깜짝 오프닝이에요.',
    preview: '한여름 무더위에 시원한 보리차를 꺼내려 냉장고를 열었더니, 냉동실 얼음틀 위에 눈처럼 하얀 아기 북극곰이 웅크리고 앉아 있었다.'
  },
  {
    title: '구름을 낚는 낚싯대',
    id: 'open_4',
    description: '옥상에서 하늘의 구름을 낚아채며 시작되는 환상적인 모험이에요.',
    preview: '할아버지 댁 다락방에서 찾은 무지갯빛 낚싯대를 옥상에서 휘둘렀더니, 낚싯바늘이 뭉게구름 한 조각을 솜사탕처럼 낚아챘다.'
  },
  {
    title: '거꾸로 가는 교실 시계',
    id: 'open_5',
    description: '초침이 반대로 돌며 시간이 뒤로 감기는 미스터리한 오프닝이에요.',
    preview: '수학 시험지를 받는 순간 교실 시계 초침이 반대 방향으로 째깍째깍 돌더니, 교실 안 모든 친구들이 뒤로 걷기 시작했다.'
  },
  {
    title: '사물함 속 우주 신호',
    id: 'open_6',
    description: '체육복 속에서 밤하늘 별자리 암호가 깜빡이는 SF 판타지예요.',
    preview: '운동장 체육 수업이 끝나고 사물함을 열었을 때, 체육복 속에서 삐비빅 소리를 내며 밤하늘 별자리 암호가 깜빡였다.'
  },
  {
    title: '투명해진 고양이',
    id: 'open_7',
    description: '꼬리부터 유리처럼 투명해지며 사라지는 신비로운 시작이에요.',
    preview: '아침에 고양이를 부르자 방 한가운데서 방울 소리만 짤랑거릴 뿐, 발자국만 퐁퐁 찍히고 몸은 투명인간처럼 사라져 있었다.'
  },
  {
    title: '무지개 사탕 우산',
    id: 'open_8',
    description: '비 오는 날 우산을 펼치자 빗방울이 사탕으로 변하는 달콤한 오프닝이에요.',
    preview: '장마철 비구름이 잔뜩 낀 날 노란 우산을 팡 펼쳤더니, 우산살 사이로 보랏빛 음악 소리가 흘러나오며 발밑이 둥실 떠올랐다.'
  },
  {
    title: '도서관의 숨겨진 책',
    id: 'open_9',
    description: '먼지 쌓인 서가에서 날개 달린 글자들이 날아오르는 오프닝이에요.',
    preview: '학교 도서관 옛날 서가에서 낡은 책 한 권을 건드렸더니, 책장 사이에서 날개 달린 글자들이 나비처럼 일제히 날아올랐다.'
  },
  {
    title: '시간을 멈추는 오색 분필',
    id: 'open_10',
    description: '칠판 밑 분필을 줍자마자 온 세상이 얼음처럼 멈추는 오프닝이에요.',
    preview: '칠판 밑에 굴러다니던 오색 분필을 주워 손에 쥐는 순간, 귓가에 맴돌던 모든 소리가 뚝 끊기며 온 세상의 시간이 멈춰 섰다.'
  }
];

export const PRESET_STORY_IDEAS: Record<keyof StoryFramework, StoryIdeaSuggestion[]> = {
  firstSentence: DIVERSE_OPENINGS.slice(0, 3),
  character: [],
  goal: [],
  obstacle: [],
  helper: [],
  resolution: [],
  ending: [],
  completedAt: []
};

// Client-side dynamic generator anchored to student's unique first sentence
export function generateClientDynamicIdeas(
  stage: keyof StoryFramework,
  currentData: Partial<StoryFramework>
): StoryIdeaSuggestion[] {
  const fs = (currentData.firstSentence || '').trim();

  if (stage === 'firstSentence' || !fs) {
    const shuffled = [...DIVERSE_OPENINGS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map((item, idx) => ({
      id: `dyn_fs_${idx + 1}_${Date.now()}`,
      title: item.title,
      description: item.description,
      preview: item.preview
    }));
  }

  const entities = extractSentenceEntities(fs);
  const target = entities.subject || '첫 문장의 소재';
  const place = entities.placeOrObject || '신비한 배경';
  const now = Date.now();

  if (stage === 'character') {
    return [
      {
        id: `dyn_ch_1_${now}`,
        title: `${target}의 비밀을 밝히는 탐험가`,
        description: `첫 문장에 나타난 ${target}의 사건을 마주하고 용기 있게 진실을 파헤치는 주인공이에요.`,
        preview: `"${fs}" 그 순간 현장에 서 있던 주인공은 두 눈을 반짝이며, 방금 일어난 ${target}의 이상한 비밀을 끝까지 밝혀내기로 결심했다.`
      },
      {
        id: `dyn_ch_2_${now}`,
        title: `${target}과 얽힌 엉뚱한 친구`,
        description: `기발한 상상력과 엉뚱한 행동으로 ${target}과 유쾌하게 얽혀드는 특별한 주인공이에요.`,
        preview: `모두가 놀라 어리둥절할 때, 평소 엉뚱하기로 유명한 주인공은 ${target}을(를) 향해 반갑게 손을 흔들며 다가갔다.`
      },
      {
        id: `dyn_ch_3_${now}`,
        title: `${target}의 마음을 듣는 아이`,
        description: `${target}의 상황을 따뜻한 공감과 지혜로 감싸 안아주는 다정한 주인공이에요.`,
        preview: `주인공은 ${target}의 모습을 가만히 지켜보며, 남들은 모르는 외로움이나 간절한 소망이 있을 거라 생각하고 조용히 곁을 지켰다.`
      }
    ];
  }

  if (stage === 'goal') {
    return [
      {
        id: `dyn_gl_1_${now}`,
        title: `${target}의 진짜 이유 밝혀내기`,
        description: `첫 문장에서 벌어진 ${target}의 신기한 일의 원인을 밝혀 안전하게 원래대로 돌려놓는 목표예요.`,
        preview: `방금 벌어진 ${target}의 기묘한 소동의 원인을 찾아내고, 뒤죽박죽된 상황을 말끔히 원래대로 되돌려놓는 것이었다.`
      },
      {
        id: `dyn_gl_2_${now}`,
        title: `${place}을(를) 향한 두근두근 모험`,
        description: `첫 문장을 시작으로 ${place} 너머 미지의 세계로 당당하게 모험을 떠나는 목표예요.`,
        preview: `두려움을 털어내고 ${target}이(가) 가리키는 ${place} 너머 미지의 세상으로 나아가 감춰진 보물을 찾는 것이었다.`
      },
      {
        id: `dyn_gl_3_${now}`,
        title: `${target}과 나눈 소중한 약속`,
        description: `첫 문장에서 마주한 ${target}을(를) 돕거나 서로에게 한 약속을 지켜내는 따뜻한 목표예요.`,
        preview: `위험에 처한 ${target}을(를) 지켜주고, 마음속 깊이 약속했던 소중한 다짐을 반드시 지켜내는 것이었다.`
      }
    ];
  }

  if (stage === 'obstacle') {
    return [
      {
        id: `dyn_ob_1_${now}`,
        title: `${target}이(가) 사라지거나 굳어버린 위기`,
        description: `첫 문장의 ${target}과 관련된 중요한 단서가 갑자기 엉키거나 사라지는 돌발 상황이에요.`,
        preview: `한 걸음 다가서려는 찰나, ${target} 주위로 이상한 안개가 자욱하게 피어오르더니 눈 깜짝할 사이에 단서가 사라져버렸다.`
      },
      {
        id: `dyn_ob_2_${now}`,
        title: `${target}을(를) 노리는 짓궂은 방해꾼`,
        description: `첫 문장의 비밀을 가로채거나 엉망으로 만들려는 훼방꾼이 나타나는 전개예요.`,
        preview: `${target}의 비밀을 호시탐탐 엿보던 짓궂은 경쟁자가 갑자기 끼어들어 앞길을 가로막고 훼방을 놓기 시작했다.`
      },
      {
        id: `dyn_ob_3_${now}`,
        title: `시간 부족과 서툰 마음`,
        description: `시간이 얼마 남지 않은 상황에서 실수와 오해가 겹치며 커지는 위기예요.`,
        preview: `${target}을(를) 해결할 시간이 얼마 남지 않았는데, 마음이 급해져 사소한 실수를 저지르고 말았다.`
      }
    ];
  }

  if (stage === 'helper') {
    return [
      {
        id: `dyn_hp_1_${now}`,
        title: `${target}을(를) 잘 아는 의외의 친구`,
        description: `위기의 순간 나타나 ${target}에 얽힌 결정적인 힌트를 건네주는 든든한 조력자예요.`,
        preview: `절망하려던 순간, 옆에서 조용히 지켜보던 친구가 ${target}에 관한 비밀이 적힌 낡은 수첩을 건네주었다.`
      },
      {
        id: `dyn_hp_2_${now}`,
        title: `${place}에서 발견한 특별한 도구`,
        description: `첫 문장의 배경이나 주변에서 발견한 신비로운 물건이 힘을 발휘하는 순간이에요.`,
        preview: `주머니 속에 우연히 넣어두었던 작은 물건이 ${target}의 기운에 반응하며 은은한 빛을 뿜어내기 시작했다.`
      },
      {
        id: `dyn_hp_3_${now}`,
        title: `포기하지 않는 마음과 용기`,
        description: `어려움 속에서 스스로 깨달은 내면의 용기와 친구들의 응원이에요.`,
        preview: `"할 수 있어!" 친구들의 응원 소리에 힘을 얻은 주인공은 마음 깊은 곳에서 뜨거운 용기를 끌어올렸다.`
      }
    ];
  }

  if (stage === 'resolution') {
    return [
      {
        id: `dyn_rs_1_${now}`,
        title: `기발한 아이디어로 ${target} 문제 해결`,
        description: `남들이 생각하지 못한 참신한 기지와 협동으로 위기를 멋지게 돌파하는 장면이에요.`,
        preview: `주인공은 번뜩이는 재치를 발휘해 ${target}의 약점을 지혜롭게 활용했고, 친구들과 힘을 합쳐 단숨에 위기를 극복했다.`
      },
      {
        id: `dyn_rs_2_${now}`,
        title: `${target}에게 건넨 따뜻한 진심`,
        description: `싸움이 아닌 진심 어린 소통으로 갈등을 사르르 녹여내는 감동적인 해결 장면이에요.`,
        preview: `주인공이 떨리는 손으로 ${target}에게 따뜻한 한마디를 건네자, 차갑게 굳어 있던 방해물이 눈 녹듯 사라졌다.`
      },
      {
        id: `dyn_rs_3_${now}`,
        title: `온 힘을 다한 극적인 역전`,
        description: `마지막 순간까지 포기하지 않고 온 힘을 쏟아 기적을 만들어내는 통쾌한 장면이에요.`,
        preview: `마지막 1초를 남겨두고 온 힘을 다해 몸을 날려 마침내 ${target}의 스위치를 안전하게 되돌려놓았다.`
      }
    ];
  }

  // ending
  return [
    {
      id: `dyn_ed_1_${now}`,
      title: `${target}과 함께 만든 훈훈한 결말`,
      description: `모험이 끝나고 일상으로 돌아왔지만 주인공의 마음이 한 뼘 더 자란 감동의 마무리예요.`,
      preview: `모든 소동이 끝나고 평화가 찾아왔지만, 주인공의 가슴속에는 ${target}과 함께 나눈 기적 같은 추억이 보석처럼 빛났다.`
    },
    {
      id: `dyn_ed_2_${now}`,
      title: `내일을 기대하게 하는 설레는 결말`,
      description: `또 다른 신비로운 모험을 암시하며 기분 좋은 미소를 남기는 여운 가득한 결말이에요.`,
      preview: `창밖을 바라보며 살며시 미소를 지었다. 내일 아침에는 또 어떤 신나는 일이 나를 기다리고 있을까?`
    },
    {
      id: `dyn_ed_3_${now}`,
      title: `다 함께 웃음을 터뜨리는 유쾌한 결말`,
      description: `모두가 한바탕 웃으며 유쾌하고 행복하게 책장을 덮는 마무리예요.`,
      preview: `서로의 얼굴을 쳐다보며 까르르 웃음을 터뜨렸다. 오늘은 우리 모두에게 평생 잊지 못할 가장 특별한 날이었다.`
    }
  ];
}

export async function requestStoryIdeas(
  stage: keyof StoryFramework,
  currentData: Partial<StoryFramework>,
  grade: number = 6,
  topicTitle?: string,
  studentName?: string,
  userHint?: string
): Promise<StoryIdeaSuggestion[]> {
  try {
    const res = await fetch(`/api/gemini/story-ideas?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify({
        stage,
        currentData,
        grade,
        topicTitle,
        studentName,
        userHint,
        randomSeed: Date.now() + Math.random()
      })
    });

    if (!res.ok) {
      throw new Error(`스토리 아이디어 API 응답 오류: ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions.map((s: any, idx: number) => ({
        id: s.id || `gen_${stage}_${idx}_${Date.now()}`,
        title: s.title || `아이디어 ${idx + 1}`,
        description: s.description || '',
        preview: s.preview || s.text || s.content || ''
      }));
    }
  } catch (err) {
    console.warn('requestStoryIdeas fallback used due to:', err);
  }

  // Generate dynamic client fallback tailored to student's unique input
  return generateClientDynamicIdeas(stage, currentData);
}

export interface OutlineExamples {
  exposition: string;
  development: string;
  climax: string;
  resolution: string;
}

export async function requestOutlineExamples(
  storyFramework: StoryFramework,
  grade: number = 6
): Promise<OutlineExamples> {
  try {
    const res = await fetch(`/api/gemini/outline-examples?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify({ storyFramework, grade })
    });

    if (!res.ok) {
      throw new Error(`Outline examples API status: ${res.status}`);
    }

    const data = await res.json();
    if (data.success && data.examples) {
      return {
        exposition: (data.examples.exposition || '').trim(),
        development: (data.examples.development || '').trim(),
        climax: (data.examples.climax || '').trim(),
        resolution: (data.examples.resolution || '').trim()
      };
    }
    throw new Error('예시 응답 데이터가 없습니다.');
  } catch (err) {
    console.warn('requestOutlineExamples fallback:', err);
    return generateFallback1SentenceExamples(storyFramework);
  }
}

function generateFallback1SentenceExamples(sf: StoryFramework): OutlineExamples {
  const fs = sf.firstSentence?.trim();
  const ch = sf.character?.trim();
  const gl = sf.goal?.trim();
  const ob = sf.obstacle?.trim();
  const hp = sf.helper?.trim();
  const rs = sf.resolution?.trim();
  const ed = sf.ending?.trim();

  const exp = fs
    ? `${fs} 바로 그곳에서 ${ch ? `${ch}의` : '주인공의'} 잊지 못할 특별한 모험이 시작되었다.`
    : `평화롭던 어느 날, ${ch ? ch : '주인공'}에게 믿기 힘든 신비로운 사건이 시작되었다.`;

  const dev = gl
    ? `주인공은 ${gl} 위해 ${hp ? `${hp}의 도움을 받으며` : '한 걸음씩'} 용기 있게 모험의 길을 나섰다.`
    : `주인공은 꿈꾸던 목표를 이루기 위해 설레는 마음으로 새로운 도전을 시작했다.`;

  const clx = ob
    ? `하지만 예상치 못했던 ${ob} 때문에 주인공은 가장 절박하고 위험천만한 위기에 맞닥뜨렸다.`
    : `순조롭던 여정 앞에 갑작스럽고 거대한 시련이 닥쳐오며 모든 것이 무너질 뻔한 절체절명의 순간을 맞이했다.`;

  const res = rs
    ? `주인공은 포기하지 않고 ${rs} 기지와 용기를 발휘하여 마침내 모든 위기를 극복하고 ${ed || '따뜻한 감동'}을 맞이하였다.`
    : `친구들과 지혜를 모아 위기를 극복해 낸 주인공은 한 뼘 더 자란 마음으로 ${ed || '행복하고 따뜻한 마무리'}를 완성하였다.`;

  return {
    exposition: exp,
    development: dev,
    climax: clx,
    resolution: res
  };
}


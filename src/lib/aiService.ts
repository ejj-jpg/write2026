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
  try {
    const res = await fetch('/api/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error || `서버 오류 (${res.status})`,
        error: errData.error,
        latencyMs
      };
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message,
      model: data.model,
      latencyMs
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      message: `Gemini API 연결 실패: ${err.message}`,
      error: err.message,
      latencyMs
    };
  }
}

export async function requestAITopics(grade: number, category: string, keywords: string = ''): Promise<DailyTopic[]> {
  try {
    const res = await fetch('/api/gemini/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch('/api/gemini/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch('/api/gemini/proofread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      reason: s.reason || '',
      applied: false
    }))
  };
}

export async function requestProcessAssessmentDraft(
  studentName: string,
  grade: number,
  record: WritingRecord
): Promise<string> {
  const res = await fetch('/api/gemini/process-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName, grade, record })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '과정중심평가 초안 생성 실패');
  }

  const data = await res.json();
  return data.aiAssessmentDraft || '';
}

export const PRESET_STORY_IDEAS: Record<keyof StoryFramework, StoryIdeaSuggestion[]> = {
  firstSentence: [
    {
      id: 'fs_1',
      title: '비밀 서랍',
      description: '일상 속 물건에서 신비한 문이 열리는 호기심 가득한 오프닝',
      preview: '비가 그치자 낡은 서랍 속에서 작은 비밀의 문이 딸깍하고 열렸어요.'
    },
    {
      id: 'fs_2',
      title: '말하는 고양이',
      description: '반려동물이 말을 걸어오는 유쾌하고 두근거리는 시작',
      preview: '오늘 아침, 우리 집 고양이가 사람의 목소리로 "좋은 아침!" 하고 인사를 건넸어요.'
    },
    {
      id: 'fs_3',
      title: '구름 자판기',
      description: '학교 운동장에서 발견한 신기한 물건으로 펼쳐지는 상상',
      preview: '학교 운동장 구석에 어제까지는 보이지 않던 알록달록한 구름 자판기가 놓여 있었어요.'
    }
  ],
  character: [
    {
      id: 'ch_1',
      title: '아기 다람쥐 도토리',
      description: '작지만 용기 있고 반짝이는 별빛을 모으는 숲속 친구',
      preview: '별빛을 모으는 호기심 많은 아기 다람쥐 "도토리"'
    },
    {
      id: 'ch_2',
      title: '꼬마 발명가 준이',
      description: '엉뚱한 기계를 잘 만들지만 그림자가 도망쳐 고민인 어린이',
      preview: '자신의 그림자가 도망쳐버려 울상이 된 엉뚱한 꼬마 발명가 "준이"'
    },
    {
      id: 'ch_3',
      title: '젤리 요정 퐁퐁이',
      description: '말랑말랑 달콤한 냄새가 나고 수줍음이 많은 특별한 요정',
      preview: '달콤한 딸기 향기가 나지만 소심해서 부끄러움을 많이 타는 젤리 요정 "퐁퐁이"'
    }
  ],
  goal: [
    {
      id: 'gl_1',
      title: '은하수 되돌리기',
      description: '하늘에서 잃어버린 별 조각을 제자리로 돌려주는 따뜻한 사명',
      preview: '밤하늘에서 떨어진 은하수 조각을 찾아 하늘 높이 원래 자리로 돌려놓고 싶어요.'
    },
    {
      id: 'gl_2',
      title: '친구의 미소 찾기',
      description: '항상 슬퍼 보이는 짝꿍을 위해 가장 환한 웃음을 선물하는 일',
      preview: '혼자 외로워하는 숲속 짝꿍 친구에게 세상에서 가장 따뜻한 웃음을 선물하고 싶어요.'
    },
    {
      id: 'gl_3',
      title: '도망친 그림자와 화해',
      description: '나를 떠난 그림자를 찾아가 사과하고 다시 단짝이 되는 것',
      preview: '도망쳐버린 내 그림자를 찾아 사과하고 다시 둘도 없는 단짝 친구가 되는 것이에요.'
    }
  ],
  obstacle: [
    {
      id: 'ob_1',
      title: '먹구름 괴물',
      description: '차가운 얼음과 강한 소용돌이바람으로 길을 막는 훼방꾼',
      preview: '장난꾸러기 먹구름 괴물이 나타나 길을 꽁꽁 얼리고 소용돌이바람을 일으켜 앞을 가로막았어요.'
    },
    {
      id: 'ob_2',
      title: '망각의 안개',
      description: '소중한 기억과 방향을 잃어버리게 만드는 신비한 숲의 안개',
      preview: '기억을 지워버리는 짙은 보라색 안개가 숲 전체를 뒤덮어 갈 길을 잃게 만들었어요.'
    },
    {
      id: 'ob_3',
      title: '욕심쟁이 두더지',
      description: '비밀 지도의 마지막 조각을 깊은 땅속에 숨겨버린 두더지',
      preview: '비밀 지도의 마지막 조각을 욕심쟁이 두더지가 땅속 깊은 미로 동굴에 숨겨버렸어요.'
    }
  ],
  helper: [
    {
      id: 'hp_1',
      title: '길잡이 반딧불이 루미',
      description: '어두운 곳에서도 환하게 길을 비춰주는 충직하고 다정한 친구',
      preview: '어두운 밤길을 밝혀주는 따뜻한 빛의 길잡이 반딧불이 친구 "루미"'
    },
    {
      id: 'hp_2',
      title: '마법 소원 나침반',
      description: '할머니의 사랑과 달콤한 용기가 듬뿍 묻어나는 신비한 보물',
      preview: '할머니가 장롱 속에 넣어두셨던 마법의 소원 나침반과 달콤한 용기 사탕'
    },
    {
      id: 'hp_3',
      title: '지혜로운 참새 삼총사',
      description: '위기의 순간마다 높은 곳에서 지혜로운 힌트를 속삭여주는 조력자',
      preview: '어려울 때마다 귓가에 힌트를 속삭여주는 지혜로운 참새 삼총사'
    }
  ],
  resolution: [
    {
      id: 'rs_1',
      title: '빛과 용기의 온기',
      description: '서로를 향한 믿음과 온기로 차가운 먹구름을 따스하게 녹이기',
      preview: '친구들과 두 손을 맞잡고 서로를 믿으며 마음속 용기의 빛으로 먹구름을 녹였어요.'
    },
    {
      id: 'rs_2',
      title: '역할 분담과 지혜',
      description: '당황하지 않고 친구와 힘을 합쳐 수수께끼 함정을 탈출',
      preview: '혼자 힘으로는 어려웠지만, 돕는 친구와 역할을 나누어 침착하게 함정을 빠져나왔어요.'
    },
    {
      id: 'rs_3',
      title: '진심 어린 나눔',
      description: '싸우는 대신 따뜻한 마음을 먼저 건네어 마음의 문을 열기',
      preview: '욕심쟁이 두더지에게 먼저 따뜻한 도토리를 건네며 마음을 열고 조각을 돌려받았어요.'
    }
  ],
  ending: [
    {
      id: 'ed_1',
      title: '별빛 축제와 성취',
      description: '온 마을에 빛이 돌아오고 모두가 다 함께 기뻐하는 해피엔딩',
      preview: '온 마을에 따뜻한 별빛이 내리고, 주인공은 이제 무엇이든 해낼 수 있는 용기를 품게 되었어요.'
    },
    {
      id: 'ed_2',
      title: '약속의 무지개',
      description: '진정한 우정을 확인하고 둘만의 추억을 간직하는 훈훈한 끝',
      preview: '서로의 손을 꼭 잡고 활짝 웃으며, 둘만의 비밀이 담긴 아름다운 무지개를 함께 바라보았어요.'
    },
    {
      id: 'ed_3',
      title: '두근거리는 내일',
      description: '작지만 훌쩍 성장한 자신을 느끼며 새로운 하루를 맞이하는 결말',
      preview: '모험을 마친 주인공은 한 뼘 더 자란 마음으로 내일의 새로운 하루를 두근거리며 맞이했어요.'
    }
  ],
  completedAt: []
};

export async function requestStoryIdeas(
  stage: keyof StoryFramework,
  currentData: Partial<StoryFramework>,
  grade: number = 6
): Promise<StoryIdeaSuggestion[]> {
  try {
    const res = await fetch('/api/gemini/story-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, currentData, grade })
    });

    if (!res.ok) {
      throw new Error(`스토리 아이디어 API 응답 오류: ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions.map((s: any, idx: number) => ({
        id: s.id || `gen_${stage}_${idx}`,
        title: s.title || `아이디어 ${idx + 1}`,
        description: s.description || '',
        preview: s.preview || s.text || ''
      }));
    }
  } catch (err) {
    console.warn('requestStoryIdeas fallback used due to:', err);
  }

  // 첫 문장이 있으면 첫 문장 맞춤형 동적 폴백 제안 생성
  const fs = currentData.firstSentence?.trim();
  if (fs) {
    const shortFs = fs.length > 20 ? `${fs.slice(0, 20)}...` : fs;
    if (stage === 'character') {
      return [
        {
          id: 'dyn_ch_1',
          title: '첫 문장의 주인공',
          description: `"${shortFs}"의 사건을 직접 마주하는 용기 있는 주인공`,
          preview: `그 순간 바로 그 자리에 서 있던 주인공은 호기심이 많고 무슨 일이든 끝까지 파헤치는 특별한 성격을 지니고 있었다.`
        },
        {
          id: 'dyn_ch_2',
          title: '비밀을 품은 친구',
          description: `첫 문장의 상황에 대해 남모를 비밀이나 단서를 간직한 캐릭터`,
          preview: `겉모습은 평범해 보이지만 가슴속에 아무도 모르는 마법의 비밀을 간직한 채 조용히 관찰하던 주인공이었다.`
        },
        {
          id: 'dyn_ch_3',
          title: '엉뚱한 해결사',
          description: `엉뚱하지만 기발한 상상력으로 사건을 풀어갈 유쾌한 주인공`,
          preview: `늘 엉뚱한 행동으로 주변을 놀라게 하지만 위기의 순간마다 번뜩이는 아이디어를 내는 매력적인 주인공이었다.`
        }
      ];
    }
    if (stage === 'goal') {
      return [
        {
          id: 'dyn_gl_1',
          title: '진실 찾기',
          description: '첫 문장에서 벌어진 이상하고 놀라운 일의 원인을 밝혀내는 것',
          preview: `방금 일어난 기묘한 일의 비밀을 풀고 잃어버린 소중한 무언가를 제자리로 되돌려놓는 것이었다.`
        },
        {
          id: 'dyn_gl_2',
          title: '약속 지키기',
          description: '위험에 빠진 대상을 구하거나 친구와의 약속을 지키는 목표',
          preview: `더 큰 혼란이 일어나기 전에 친구들을 안전하게 지키고 소중한 약속을 반드시 지켜내는 것이었다.`
        },
        {
          id: 'dyn_gl_3',
          title: '새로운 세상 탐험',
          description: '첫 문장을 계기로 펼쳐질 미지의 세계로 당당하게 모험을 떠나는 것',
          preview: `두려움을 떨치고 한 번도 가보지 못한 미지의 세상으로 나아가 꿈꾸던 소망을 이루는 것이었다.`
        }
      ];
    }
  }

  return PRESET_STORY_IDEAS[stage] || [];
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
    const res = await fetch('/api/gemini/outline-examples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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


import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// High-speed, high-availability Gemini models with automatic failover
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

app.use(express.json({ limit: '10mb' }));

// Global CORS, Preflight, and Cache-Control handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Helper to get Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 환경변수에 설정되어 있지 않습니다.');
  }
  return new GoogleGenAI({ apiKey });
}

// Helper to safely parse JSON from model responses
function parseJsonSafely(text: string, fallback: any = {}) {
  if (!text || typeof text !== 'string') return fallback;
  try {
    const cleaned = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerErr) {
        console.warn('Regex JSON parse fallback failed:', innerErr);
      }
    }
    return fallback;
  }
}

// Universal robust generateContent with multi-model fallback and timeout
async function generateContentWithFallback(
  contents: string,
  config?: any
): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      console.log(`[Gemini] Trying model: ${model}`);
      const startTime = Date.now();
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents,
          config: {
            ...config,
            responseMimeType: config?.responseMimeType || 'application/json'
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`모델 ${model} 응답 시간 초과(25초)`)), 25000)
        )
      ]);
      console.log(`[Gemini] Model ${model} responded in ${Date.now() - startTime}ms`);

      const extractedText = (
        response?.text ||
        (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ||
        ''
      ).trim();

      if (extractedText) {
        return { text: extractedText, model };
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} failed (${err?.status || err?.message}), trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('모든 Gemini AI 모델 호출에 실패했습니다.');
}

// Fallback feedback generator if all external network calls fail
function generateFallbackFeedback(
  draft: string,
  planning: any,
  grade: number = 4
) {
  const safeDraft = typeof draft === 'string' ? draft : '';
  const wordCount = safeDraft.trim().split(/\s+/).filter(Boolean).length || 10;
  const sentenceCount = (safeDraft.match(/[.!?]/g) || []).length || 2;
  const title = (planning?.title && typeof planning.title === 'string') ? planning.title : '나의 이야기';

  return {
    strengths: [
      `‘${title}’의 내용을 ${wordCount}개의 낱말과 ${sentenceCount}개 이상의 문장으로 풍부하고 솔직하게 표현했어요.`,
      `초고의 첫 시작부터 학생만의 솔직한 생각과 재미있는 상상이 돋보여요.`
    ],
    improvements: [
      `인물들의 생생한 대화나 그때 느꼈던 마음의 소리를 ‘큰따옴표’로 1~2문장 더 적어보면 훨씬 흥미진진해질 거예요.`,
      `장면이 바뀔 때 어떤 소리나 표정이었는지 흉내말(의성어·의태어)을 덧붙여 보세요.`
    ],
    reasoning: `초등학교 ${grade}학년 어린이로서 정성을 다해 한 편의 초고를 끝까지 써낸 점이 정말 대단합니다. 스스로 다듬어볼 수 있는 좋은 기초가 마련되었습니다.`,
    topPriority: `주인공이 가장 기억에 남거나 놀랐던 순간의 생각과 대화를 한 문장 더 자세히 덧붙여 보세요!`,
    selfReflectQuestions: [
      `이 장면에서 주인공의 마음과 표정은 어땠을까요?`,
      `이야기 속 친구에게 하고 싶은 말이 있다면 무엇인가요?`
    ]
  };
}

// 1. Health check
app.all(['/api/health', '/api/health/', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    candidateModels: CANDIDATE_MODELS
  });
});

// 2. Gemini connection test (supports both GET and POST)
app.all(['/api/gemini/test', '/api/gemini/test/', '/gemini/test'], async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: '서버에 GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.'
      });
    }

    const result = await generateContentWithFallback(
      '초등학교 환영 인사 한 문장 (15자 이내):',
      { responseMimeType: 'text/plain', maxOutputTokens: 40, temperature: 0.7 }
    );
    res.json({
      success: true,
      message: result.text.trim() || 'Gemini AI 연결이 정상 작동 중입니다.',
      model: result.model
    });
  } catch (err: any) {
    console.error('Gemini test error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Gemini API 호출에 실패했습니다.'
    });
  }
});

// Helper to extract keywords and entities from a Korean sentence
function extractSentenceEntities(sentence: string = ''): {
  subject: string;
  placeOrObject: string;
  action: string;
  keywords: string[];
} {
  const clean = (sentence || '').replace(/[.!?,"'“”‘’]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(w => w.length >= 2);
  
  // Filter out common Korean particles or stop words
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

// 40+ diverse, imaginative first sentence seeds for elementary picture books
const DIVERSE_FIRST_SENTENCES = [
  {
    title: '서랍 속 작은 문',
    description: '평범한 내 방 책상 서랍 구석에서 은은한 금빛과 함께 손톱만 한 문이 딸깍 열렸다.',
    preview: '숙제를 하려고 책상 서랍을 연 순간, 서랍 안쪽 구석에서 딸깍 소리와 함께 손톱만 한 황금색 문이 스르륵 열렸다.'
  },
  {
    title: '말하는 파란 운동화',
    description: '아침에 일어나 현관으로 나갔더니 내 낡은 파란 운동화가 하품을 하며 말을 걸었다.',
    preview: '현관문을 나서려는데 신발장에 놓인 파란 운동화가 끄응 하품을 하더니 "오늘은 제발 흙탕물에 들어가지 마!"라고 소리쳤다.'
  },
  {
    title: '냉장고 속 아기 북극곰',
    description: '시원한 물을 마시려 냉장고 문을 열었더니 얼음 칸에 털북숭이 아기 북극곰이 앉아 있었다.',
    preview: '한여름 무더위에 시원한 보리차를 꺼내려 냉장고를 열었더니, 냉동실 얼음틀 위에 눈처럼 하얀 아기 북극곰이 웅크리고 앉아 있었다.'
  },
  {
    title: '구름을 낚는 낚싯대',
    description: '할아버지 다락방 구석에서 먼지 쌓인 낚싯대를 집어 들었더니 낚싯줄이 창밖 하늘 구름으로 솟구쳤다.',
    preview: '할아버지 댁 다락방에서 찾은 무지갯빛 낚싯대를 옥상에서 휘둘렀더니, 낚싯바늘이 뭉게구름 한 조각을 솜사탕처럼 낚아챘다.'
  },
  {
    title: '거꾸로 가는 교실 시계',
    description: '교실 벽걸이 시계 초침이 갑자기 거꾸로 빠르게 돌더니 창밖 풍경이 어제로 돌아가기 시작했다.',
    preview: '수학 시험지를 받는 순간 교실 시계 초침이 반대 방향으로 째깍째깍 돌더니, 교실 안 모든 친구들이 뒤로 걷기 시작했다.'
  },
  {
    title: '사물함 속 우주 신호',
    description: '체육 시간 후 사물함을 열었더니 초록색 전파 신호와 함께 외계 행성 지도가 펼쳐졌다.',
    preview: '운동장 체육 수업이 끝나고 4학년 2반 사물함을 열었을 때, 체육복 속에서 삐비빅 소리를 내며 밤하늘 별자리 암호가 깜빡였다.'
  },
  {
    title: '투명해진 얼룩고양이',
    description: '아침밥을 주려는데 우리 집 얼룩고양이의 꼬리부터 서서히 유리처럼 투명해지고 있었다.',
    preview: '아침에 "나비야" 하고 불렀더니 방 한가운데서 방울 소리만 짤랑거릴 뿐, 고양이의 발자국만 퐁퐁 찍히고 몸은 투명인간처럼 사라져 있었다.'
  },
  {
    title: '비 오는 날의 무지개 우산',
    description: '빗속에서 우산을 활짝 펼치자 빗방울이 바닥에 닿는 대신 달콤한 사탕 알갱이로 변해 튀어 올랐다.',
    preview: '장마철 비구름이 잔뜩 낀 날 노란 우산을 팡 펼쳤더니, 우산살 사이로 보랏빛 음악 소리가 흘러나오며 발밑이 둥실 떠올랐다.'
  },
  {
    title: '도서관의 숨겨진 책',
    description: '도서관 맨 구석 서가에서 표지가 없는 두꺼운 책을 꺼내자 내 이름이 적힌 비밀 페이지가 나타났다.',
    preview: '학교 도서관 먼지 쌓인 옛날 서가에서 책 한 권을 툭 건드렸더니, 책장 사이에서 날개 달린 글자들이 나비처럼 날아올랐다.'
  },
  {
    title: '시간을 멈추는 분필',
    description: '칠판 밑에 떨어진 형광빛 분필로 바닥에 동그라미를 그렸더니 운동장의 모든 사람이 멈췄다.',
    preview: '칠판 밑에 굴러다니던 오색 분필을 주워 손에 쥐는 순간, 귓가에 맴돌던 모든 소리가 뚝 끊기며 온 세상의 시간이 멈춰 섰다.'
  },
  {
    title: '그림 속으로 들어간 크레파스',
    description: '도화지에 문을 그렸더니 종이 속 문고리가 덜컹거리며 진짜로 열리기 시작했다.',
    preview: '미술 시간에 도화지에 숲속 오솔길을 그렸는데, 갈색 크레파스 자국을 따라 솔바람이 불어오더니 내 손가락이 그림 속으로 쑥 빨려 들어갔다.'
  },
  {
    title: '가로등 밑 꼬마 도깨비',
    description: '어둑한 저녁 골목길에서 가로등 전구 불빛을 숟가락으로 떠먹고 있는 꼬마를 만났다.',
    preview: '학원이 끝나고 돌아오던 어둑한 저녁, 전봇대 꼭대기에서 노란 전등 불빛을 숟가락으로 떠먹고 있는 뿔 달린 꼬마를 목격했다.'
  }
];

// 2-1. Picture Book Story Ideas Generation (학생의 첫 문장 및 이전 단계 설정에 맞춘 3가지 아이디어 예시 생성)
// Dynamic fallback for story ideas tailored to student's first sentence
function generateDynamicStoryIdeas(
  stage: string,
  currentData: Record<string, any> = {},
  grade: number = 4
): Array<{ id: string; title: string; description: string; preview: string }> {
  const fs = (currentData.firstSentence || '').trim();

  if (stage === 'firstSentence' || !fs) {
    // Return 3 randomly shuffled items from diverse first sentences
    const shuffled = [...DIVERSE_FIRST_SENTENCES].sort(() => 0.5 - Math.random());
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

  if (stage === 'character') {
    return [
      {
        id: `dyn_ch_1_${Date.now()}`,
        title: `${target}의 비밀을 밝히는 탐험가`,
        description: `첫 문장에 나타난 ${target}의 사건을 마주하고 용기 있게 진실을 파헤치는 주인공이에요.`,
        preview: `"${fs}" 그 순간 현장에 서 있던 주인공은 두 눈을 반짝이며, 방금 일어난 ${target}의 이상한 비밀을 끝까지 밝혀내기로 결심했다.`
      },
      {
        id: `dyn_ch_2_${Date.now()}`,
        title: `${target}과 얽힌 엉뚱한 친구`,
        description: `기발한 상상력과 엉뚱한 행동으로 ${target}과 유쾌하게 얽혀드는 특별한 주인공이에요.`,
        preview: `모두가 놀라 어리둥절할 때, 평소 엉뚱하기로 유명한 주인공은 ${target}을(를) 향해 반갑게 손을 흔들며 다가갔다.`
      },
      {
        id: `dyn_ch_3_${Date.now()}`,
        title: `${target}의 마음을 듣는 아이`,
        description: `${target}의 상황을 따뜻한 공감과 지혜로 감싸 안아주는 다정한 주인공이에요.`,
        preview: `주인공은 ${target}의 모습을 가만히 지켜보며, 남들은 모르는 외로움이나 간절한 소망이 있을 거라 생각하고 조용히 곁을 지켰다.`
      }
    ];
  }

  if (stage === 'goal') {
    return [
      {
        id: `dyn_gl_1_${Date.now()}`,
        title: `${target}의 진짜 이유 밝혀내기`,
        description: `첫 문장에서 벌어진 ${target}의 신기한 일의 원인을 밝혀 안전하게 원래대로 돌려놓는 목표예요.`,
        preview: `방금 벌어진 ${target}의 기묘한 소동의 원인을 찾아내고, 뒤죽박죽된 상황을 말끔히 원래대로 되돌려놓는 것이었다.`
      },
      {
        id: `dyn_gl_2_${Date.now()}`,
        title: `${place}을(를) 향한 두근두근 모험`,
        description: `첫 문장을 시작으로 ${place} 너머 미지의 세계로 당당하게 모험을 떠나는 목표예요.`,
        preview: `두려움을 털어내고 ${target}이(가) 가리키는 ${place} 너머 미지의 세상으로 나아가 감춰진 보물을 찾는 것이었다.`
      },
      {
        id: `dyn_gl_3_${Date.now()}`,
        title: `${target}과 나눈 소중한 약속`,
        description: `첫 문장에서 마주한 ${target}을(를) 돕거나 서로에게 한 약속을 지켜내는 따뜻한 목표예요.`,
        preview: `위험에 처한 ${target}을(를) 지켜주고, 마음속 깊이 약속했던 소중한 다짐을 반드시 지켜내는 것이었다.`
      }
    ];
  }

  if (stage === 'obstacle') {
    return [
      {
        id: `dyn_ob_1_${Date.now()}`,
        title: `${target}이(가) 사라지거나 굳어버린 위기`,
        description: `첫 문장의 ${target}과 관련된 중요한 단서가 갑자기 엉키거나 사라지는 돌발 상황이에요.`,
        preview: `한 걸음 다가서려는 찰나, ${target} 주위로 이상한 안개가 자욱하게 피어오르더니 눈 깜짝할 사이에 단서가 사라져버렸다.`
      },
      {
        id: `dyn_ob_2_${Date.now()}`,
        title: `${target}을(를) 노리는 짓궂은 방해꾼`,
        description: `첫 문장의 비밀을 가로채거나 엉망으로 만들려는 훼방꾼이 나타나는 전개예요.`,
        preview: `${target}의 비밀을 호시탐탐 엿보던 짓궂은 경쟁자가 갑자기 끼어들어 앞길을 가로막고 훼방을 놓기 시작했다.`
      },
      {
        id: `dyn_ob_3_${Date.now()}`,
        title: `시간 부족과 서툰 마음`,
        description: `시간이 얼마 남지 않은 상황에서 실수와 오해가 겹치며 커지는 위기예요.`,
        preview: `${target}을(를) 해결할 시간이 얼마 남지 않았는데, 마음이 급해져 사소한 실수를 저지르고 말았다.`
      }
    ];
  }

  if (stage === 'helper') {
    return [
      {
        id: `dyn_hp_1_${Date.now()}`,
        title: `${target}을(를) 잘 아는 의외의 친구`,
        description: `위기의 순간 나타나 ${target}에 얽힌 결정적인 힌트를 건네주는 든든한 조력자예요.`,
        preview: `절망하려던 순간, 옆에서 조용히 지켜보던 친구가 ${target}에 관한 비밀이 적힌 낡은 수첩을 건네주었다.`
      },
      {
        id: `dyn_hp_2_${Date.now()}`,
        title: `${place}에서 발견한 특별한 도구`,
        description: `첫 문장의 배경이나 주변에서 발견한 신비로운 물건이 힘을 발휘하는 순간이에요.`,
        preview: `주머니 속에 우연히 넣어두었던 작은 물건이 ${target}의 기운에 반응하며 은은한 빛을 뿜어내기 시작했다.`
      },
      {
        id: `dyn_hp_3_${Date.now()}`,
        title: `포기하지 않는 마음과 용기`,
        description: `어려움 속에서 스스로 깨달은 내면의 용기와 친구들의 응원이에요.`,
        preview: `"할 수 있어!" 친구들의 응원 소리에 힘을 얻은 주인공은 마음 깊은 곳에서 뜨거운 용기를 끌어올렸다.`
      }
    ];
  }

  if (stage === 'resolution') {
    return [
      {
        id: `dyn_rs_1_${Date.now()}`,
        title: `기발한 아이디어로 ${target} 문제 해결`,
        description: `남들이 생각하지 못한 참신한 기지와 협동으로 위기를 멋지게 돌파하는 장면이에요.`,
        preview: `주인공은 번뜩이는 재치를 발휘해 ${target}의 약점을 지혜롭게 활용했고, 친구들과 힘을 합쳐 단숨에 위기를 극복했다.`
      },
      {
        id: `dyn_rs_2_${Date.now()}`,
        title: `${target}에게 건넨 따뜻한 진심`,
        description: `싸움이 아닌 진심 어린 소통으로 갈등을 사르르 녹여내는 감동적인 해결 장면이에요.`,
        preview: `주인공이 떨리는 손으로 ${target}에게 따뜻한 한마디를 건네자, 차갑게 굳어 있던 방해물이 눈 녹듯 사라졌다.`
      },
      {
        id: `dyn_rs_3_${Date.now()}`,
        title: `온 힘을 다한 극적인 역전`,
        description: `마지막 순간까지 포기하지 않고 온 힘을 쏟아 기적을 만들어내는 통쾌한 장면이에요.`,
        preview: `마지막 1초를 남겨두고 온 힘을 다해 몸을 날려 마침내 ${target}의 스위치를 안전하게 되돌려놓았다.`
      }
    ];
  }

  // ending
  return [
    {
      id: `dyn_ed_1_${Date.now()}`,
      title: `${target}과 함께 만든 훈훈한 결말`,
      description: `모험이 끝나고 일상으로 돌아왔지만 주인공의 마음이 한 뼘 더 자란 감동의 마무리예요.`,
      preview: `모든 소동이 끝나고 평화가 찾아왔지만, 주인공의 가슴속에는 ${target}과 함께 나눈 기적 같은 추억이 보석처럼 빛났다.`
    },
    {
      id: `dyn_ed_2_${Date.now()}`,
      title: `내일을 기대하게 하는 설레는 결말`,
      description: `또 다른 신비로운 모험을 암시하며 기분 좋은 미소를 남기는 여운 가득한 결말이에요.`,
      preview: `창밖을 바라보며 살며시 미소를 지었다. 내일 아침에는 또 어떤 신나는 일이 나를 기다리고 있을까?`
    },
    {
      id: `dyn_ed_3_${Date.now()}`,
      title: `다 함께 웃음을 터뜨리는 유쾌한 결말`,
      description: `모두가 한바탕 웃으며 유쾌하고 행복하게 책장을 덮는 마무리예요.`,
      preview: `서로의 얼굴을 쳐다보며 까르르 웃음을 터뜨렸다. 오늘은 우리 모두에게 평생 잊지 못할 가장 특별한 날이었다.`
    }
  ];
}

// 2-1. Picture Book Story Ideas Generation (학생의 첫 문장 및 이전 단계 설정에 맞춘 3가지 아이디어 예시 생성)
app.all(['/api/gemini/story-ideas', '/api/gemini/story-ideas/', '/gemini/story-ideas'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const payload = req.method === 'GET' ? req.query : req.body;
    const {
      stage = 'firstSentence',
      currentData = {},
      grade = 6,
      topicTitle = '',
      studentName = '',
      userHint = '',
      randomSeed = Date.now()
    } = payload || {};

    const stageNames: Record<string, string> = {
      firstSentence: '그림책의 첫 문장 (독자의 호기심을 확 사로잡는 매력적인 첫 문장)',
      character: '1. 주인공 (첫 문장의 배경 및 사건에 어울리는 개성 있고 매력적인 주인공)',
      goal: '2. 하고 싶은 일 (첫 문장과 주인공의 입장에서 꼭 이루고 싶은 간절한 소망이나 모험의 목표)',
      obstacle: '3. 주인공을 방해하는 것 (첫 문장의 세계관과 이어지는 시련, 방해물, 악당, 돌발 상황)',
      helper: '4. 주인공을 돕는 것 (주인공을 돕는 친구, 힌트, 신비한 도구, 지혜)',
      resolution: '5. 해결과정 (위기를 극복하고 용기와 기지로 문제를 풀어나가는 흥미진진한 장면)',
      ending: '6. 결말 (모험이 끝난 뒤의 감동, 교훈, 따뜻하거나 유쾌한 마무리)'
    };

    const targetStageName = stageNames[stage] || stage;
    const studentFirstSentence = currentData.firstSentence ? String(currentData.firstSentence).trim() : '';

    let prompt = '';

    if (stage === 'firstSentence') {
      prompt = `당신은 대한민국 최고의 초등학교 그림책 및 동화 창작 전문 작가이자 국어 지도 교사입니다.
초등학교 ${grade}학년 학생 작가 (${studentName ? `${studentName} 학생` : '어린이 작가'})가 그림책을 쓰기 위해 '이야기를 여는 첫 문장' 아이디어를 얻고자 합니다.
${topicTitle ? `[학생이 고른 주제]: "${topicTitle}"` : ''}
${userHint ? `[학생이 원하는 특별한 키워드/분위기]: "${userHint}"` : ''}
${studentFirstSentence ? `[학생의 기존 생각이나 단어]: "${studentFirstSentence}"` : ''}
[요청 고유 시드]: ${randomSeed}

★★ [절대 원칙 - 천편일률적 클리셰 금지 및 무한한 창의적 다양성] ★★
1. **절대로 모든 학생에게 동일하거나 뻔한 동화 클리셰(흔한 다람쥐 도토리, 숲속 요정, 뻔한 먹구름 등)를 반복하지 마세요.**
2. ${studentName ? `${studentName} 학생만을 위한` : '이 어린이만을 위한'} 지금 막 떠오른 듯 신선하고 독창적인 3가지 첫 문장을 제안하세요.
3. 3가지 첫 문장은 서로 완전히 다른 장르와 색깔을 지녀야 합니다:
   - 아이디어 1 (기발한 일상 판타지/마법): 일상 속 익숙한 물건이나 공간에 갑자기 마법 같은 일이 펼쳐지는 오프닝
   - 아이디어 2 (유쾌하고 엉뚱한 반전/유머): 예상치 못한 인물이나 사물의 엉뚱한 행동으로 웃음을 터뜨리는 오프닝
   - 아이디어 3 (두근두근 모험/미스터리/SF): 비밀 통로, 미지의 신호, 시간 여행 등 가슴 뛰는 모험의 오프닝
4. 초등학교 ${grade}학년 눈높이에 맞아 즉시 머릿속에 그림이 선명하게 그려지는 생생한 문장이어야 합니다.

반드시 다음 JSON 형식으로만 응답해 주세요 (코드블록 마크다운 제외):
{
  "stage": "firstSentence",
  "suggestions": [
    {
      "id": "idea_1",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 다정하게 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 바꿔 쓸 수 있는 완성도 높은 첫 문장"
    },
    {
      "id": "idea_2",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 다정하게 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 바꿔 쓸 수 있는 완성도 높은 첫 문장"
    },
    {
      "id": "idea_3",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 다정하게 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 바꿔 쓸 수 있는 완성도 높은 첫 문장"
    }
  ]
}`;
    } else {
      let contextDesc = '';
      if (currentData.firstSentence) contextDesc += `\n- ★ [학생이 직접 쓴 첫 문장 - 핵심 세계관 중심축]: "${currentData.firstSentence}"`;
      if (currentData.character) contextDesc += `\n- 1. 주인공: "${currentData.character}"`;
      if (currentData.goal) contextDesc += `\n- 2. 하고 싶은 일(목표): "${currentData.goal}"`;
      if (currentData.obstacle) contextDesc += `\n- 3. 주인공을 방해하는 것(시련): "${currentData.obstacle}"`;
      if (currentData.helper) contextDesc += `\n- 4. 주인공을 돕는 것(조력자/도구): "${currentData.helper}"`;
      if (currentData.resolution) contextDesc += `\n- 5. 해결과정(위기 극복): "${currentData.resolution}"`;
      if (currentData.ending) contextDesc += `\n- 6. 결말: "${currentData.ending}"`;

      prompt = `당신은 초등학교 그림책 창작 전문 동화 작가이자 국어 지도 교사입니다.
초등학교 ${grade}학년 학생 작가 (${studentName ? `${studentName} 학생` : '어린이 작가'})가 자신의 그림책을 만들기 위해 이야기 씨앗을 심고 있습니다.

지금 작성할 단계: [${targetStageName}]

[현재까지 학생이 확정한 이야기 내용]:
${contextDesc || '(아직 앞 단계 내용이 없습니다.)'}
${userHint ? `[학생이 원하는 특별한 키워드/아이디어]: "${userHint}"` : ''}
[요청 고유 시드]: ${randomSeed}

★★ [가장 중요한 핵심 중심축 지침 - 학생의 첫 문장 절대 밀착] ★★
1. **[학생의 첫 문장]을 이야기의 절대적인 세계관 중심축(Anchor)으로 삼으세요!**
   - 학생의 첫 문장: "${studentFirstSentence || '첫 문장 미작성'}"
   ${studentFirstSentence ? `- 학생이 작성한 위 첫 문장의 고유한 소재, 어휘, 배경 공간, 등장물, 상황을 100% 반영해야 합니다.
   - 첫 문장에 나온 사물이나 사건과 전혀 무관한 뻔한 이야기(숲속 요정, 뻔한 아기 다람쥐 등)를 추천하면 학생의 글쓰기 흐름이 깨지므로 엄격히 금지합니다.
   - 추천하는 3가지 아이디어는 모두 첫 문장의 사건이나 인물과 필연적으로 이어져야 합니다.` : '- 첫 문장이 아직 없다면, 초등학생들이 흥미를 느낄 만한 다채롭고 참신한 아이디어를 제안해 주세요.'}
2. 3가지 아이디어는 모두 동일한 첫 문장을 기반으로 하되, 전개 방향과 색깔을 서로 완전히 다르게 하세요:
   - 아이디어 1 (신비로운 모험/판타지): 첫 문장의 비밀이나 수수께끼를 찾아 나서는 흥미진진한 전개
   - 아이디어 2 (유쾌하고 엉뚱한 유머/반전): 첫 문장의 상황에서 터져 나오는 웃음과 기상천외한 반전
   - 아이디어 3 (따뜻한 감동/우정/성장): 첫 문장의 존재와 교감하며 마음이 따뜻해지는 감동 전개
3. 각 제안의 'preview'는 초등학교 ${grade}학년 어린이가 그대로 선택하거나 자신의 생각대로 쉽게 수정할 수 있는 완성도 높은 자연스러운 구체적 문장이어야 합니다.

반드시 다음 JSON 형식으로만 응답해 주세요 (코드블록 마크다운 제외):
{
  "stage": "${stage}",
  "suggestions": [
    {
      "id": "idea_1",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    },
    {
      "id": "idea_2",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    },
    {
      "id": "idea_3",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    }
  ]
}`;
    }

    try {
      console.log(`[Story Ideas] Generating ideas for stage=${stage}, student=${studentName}, firstSentence="${studentFirstSentence.slice(0, 30)}"`);
      const response = await generateContentWithFallback(prompt, {
        temperature: 1.0,
        topP: 0.95
      });
      const parsed = parseJsonSafely(response.text, {});

      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.suggestions)) list = parsed.suggestions;
        else if (Array.isArray(parsed.ideas)) list = parsed.ideas;
        else if (Array.isArray(parsed.recommendations)) list = parsed.recommendations;
        else if (Array.isArray(parsed.data)) list = parsed.data;
        else if (Array.isArray(parsed.items)) list = parsed.items;
      }

      if (list.length > 0) {
        const formatted = list.slice(0, 3).map((item, idx) => ({
          id: item.id || `idea_${idx + 1}_${Date.now()}`,
          title: item.title || `아이디어 ${idx + 1}`,
          description: item.description || '',
          preview: item.preview || item.text || item.content || ''
        }));

        return res.json({
          success: true,
          stage,
          suggestions: formatted,
          model: response.model
        });
      }
    } catch (apiErr: any) {
      console.warn('Gemini story ideas generation failed, generating dynamic smart fallback:', apiErr?.message);
    }

    // Dynamic smart fallback tailored to student's firstSentence (NEVER static generic ideas!)
    const fallbackSuggestions = generateDynamicStoryIdeas(stage, currentData, grade);
    res.json({
      success: true,
      stage,
      suggestions: fallbackSuggestions,
      isFallback: true
    });
  } catch (err: any) {
    console.error('Story ideas gen error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '스토리 아이디어 생성에 실패했습니다.'
    });
  }
});

// 2-2. Step 2 Outline 1-Sentence Examples (계획하기 2단계 발단·전개·절정·결말 각 1문장 예시 생성)
app.post(['/api/gemini/outline-examples', '/api/gemini/outline-examples/'], async (req, res) => {
  try {
    const { storyFramework = {}, grade = 6 } = req.body;

    let contextDesc = '';
    if (storyFramework.firstSentence) contextDesc += `\n- 첫 문장: "${storyFramework.firstSentence}"`;
    if (storyFramework.character) contextDesc += `\n- 1. 주인공: "${storyFramework.character}"`;
    if (storyFramework.goal) contextDesc += `\n- 2. 하고 싶은 일(목표): "${storyFramework.goal}"`;
    if (storyFramework.obstacle) contextDesc += `\n- 3. 방해하는 것(시련/갈등): "${storyFramework.obstacle}"`;
    if (storyFramework.helper) contextDesc += `\n- 4. 돕는 것(조력자/도구): "${storyFramework.helper}"`;
    if (storyFramework.resolution) contextDesc += `\n- 5. 해결과정(위기 극복): "${storyFramework.resolution}"`;
    if (storyFramework.ending) contextDesc += `\n- 6. 결말(마무리): "${storyFramework.ending}"`;

    const prompt = `당신은 초등학교 국어 글쓰기 지도 전문 교사입니다.
초등학교 ${grade}학년 학생이 1단계에서 다음과 같이 이야기 씨앗(설정)을 작성했습니다.

[1단계 이야기 씨앗 내용]:
${contextDesc || '(아직 구체적인 씨앗이 적히지 않았습니다. 학생이 상상력을 펼칠 수 있는 1문장 예시를 제안해주세요.)'}

[요청 사항]:
2단계 [글쓰기 계획 세우기 - 이야기 흐름]에서 글쓰기를 힘들어하는 학생을 위해, [발단], [전개], [절정], [결말] 각 단계별 힌트 예시를 1문장씩 작성해주세요.

★★ 절대 준수 규칙 (가장 중요) ★★
1. [발단], [전개], [절정], [결말]의 예시는 반드시 각각 **정확히 1문장**으로만 작성해야 합니다.
2. 각 단계별 예시를 반드시 1문장으로 작성하는 이유: 학생이 이 1문장을 핵심 길잡이 삼아, 이를 참고하여 스스로 살을 덧붙이고 생각을 확장하여 길고 풍성한 글을 직접 쓰도록 유도하기 위함입니다. 절대로 2문장 이상 작성하지 마세요. (마침표 하나로 끝나는 정확히 1문장)
3. 1단계에서 학생이 쓴 첫 문장, 주인공, 사건 등이 긴밀하게 이어져 하나의 완성도 높은 이야기 뼈대가 되도록 작성해주세요.
4. 초등학교 ${grade}학년 학생 수준에 맞는 생생하고 상상력 넘치는 다정한 문체로 작성해주세요.

반드시 다음 JSON 형식으로만 응답해 주세요 (코드블록 백틱 없이 순수 JSON 문자열만 출력):
{
  "exposition": "발단 1문장 예시 (마침표로 끝나는 정확히 1문장)",
  "development": "전개 1문장 예시 (마침표로 끝나는 정확히 1문장)",
  "climax": "절정 1문장 예시 (마침표로 끝나는 정확히 1문장)",
  "resolution": "결말 1문장 예시 (마침표로 끝나는 정확히 1문장)"
}`;

    const response = await generateContentWithFallback(prompt);
    const parsed = parseJsonSafely(response.text, {});
    res.json({
      success: true,
      examples: {
        exposition: parsed.exposition || '',
        development: parsed.development || '',
        climax: parsed.climax || '',
        resolution: parsed.resolution || ''
      }
    });
  } catch (err: any) {
    console.error('Outline examples gen error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '예시 생성에 실패했습니다.'
    });
  }
});

// 3. Topic generation
app.post(['/api/gemini/topics', '/api/gemini/topics/'], async (req, res) => {
  try {
    const { grade = 4, category = '자유 글쓰기', keywords = '' } = req.body;

    const prompt = `당신은 초등학교 국어 글쓰기 지도 전문 교사입니다.
초등학교 ${grade}학년 학생 수준에 딱 맞고 흥미를 불러일으킬 수 있는 재미있고 의미 있는 글쓰기 주제 4개를 추천해주세요.
분야/키워드: ${category} ${keywords ? `(참고 키워드: ${keywords})` : ''}

반드시 다음 JSON 배열 형식으로만 응답해 주세요. 마크다운 코드블록(\`\`\`json ... \`\`\`) 없이 순수 JSON 문자열만 출력해야 합니다:
[
  {
    "id": "topic_1",
    "title": "주제 제목",
    "category": "${category}",
    "targetGrade": ${grade},
    "description": "학생이 공감하고 상상할 수 있는 친절한 설명 (2~3문장)",
    "guideQuestions": [
      "생각을 열어주는 질문 1",
      "생각을 열어주는 질문 2",
      "생각을 열어주는 질문 3"
    ]
  }
]`;

    const response = await generateContentWithFallback(prompt);
    const parsed = parseJsonSafely(response.text, []);
    res.json({ success: true, topics: Array.isArray(parsed) ? parsed : [] });
  } catch (err: any) {
    console.error('Topic gen error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '글쓰기 주제 생성에 실패했습니다.'
    });
  }
});

// 4. Student Draft Feedback
// 규정:
// 잘된 점, 보완할 점, 판단 근거, 가장 먼저 고칠 부분, 스스로 생각할 질문 포함
// 학생의 글을 AI가 대신 작성하지 마세요!
app.post(['/api/gemini/feedback', '/api/gemini/feedback/'], async (req, res) => {
  try {
    const { topicTitle, draft, planning, grade = 4 } = req.body || {};
    const safeDraft = typeof draft === 'string' ? draft.trim() : '';
    if (!safeDraft) {
      return res.status(400).json({ success: false, error: '초고 내용을 입력해주세요.' });
    }

    const ideasText = Array.isArray(planning?.ideas)
      ? planning.ideas.join(', ')
      : (typeof planning?.ideas === 'string' ? planning.ideas : '없음');

    const prompt = `당신은 초등학교 글쓰기 전문 선생님입니다.
초등학교 ${grade}학년 어린이가 쓴 초고를 읽고, 아이의 글쓰기 동기를 북돋우고 구체적으로 발전시킬 수 있는 따뜻하고 건설적인 피드백을 제공해 주세요.

[글 주제]: ${topicTitle || '자유 주제'}
[학생 글쓰기 계획]:
- 제목: ${planning?.title || '미정'}
- 글의 목적/종류: ${planning?.genre || '생활문'}
- 전달하고 싶은 중심 생각: ${ideasText}

[학생의 실제 초고]:
${safeDraft}

[중요 지침]:
1. 학생의 글을 AI가 대신 써주거나 문장을 완성해주지 마세요! 아이가 스스로 고치도록 안내만 해야 합니다.
2. 초등학생 눈높이에 맞추어 친절하고 다정한 존댓말(해요체)로 작성하세요.
3. 반드시 다음 JSON 구조로 응답하세요 (순수 JSON 문자열만, 마크다운 백틱 제외):
{
  "strengths": [
    "구체적으로 잘 쓴 점 1 (예: 경험을 생생한 흉내말을 넣어 표현한 점이 돋보여요)",
    "구체적으로 잘 쓴 점 2"
  ],
  "improvements": [
    "더 발전시킬 수 있는 부분 1 (예: 그때의 마음이 어땠는지 자세히 풀어쓰면 더 생생할 거예요)",
    "더 발전시킬 수 있는 부분 2"
  ],
  "reasoning": "선생님이 왜 그렇게 느꼈는지 아이가 납득할 수 있는 따뜻한 판단 근거 (3~4문장)",
  "topPriority": "학생이 고쳐쓸 때 '가장 먼저 고칠 부분' 1가지 (명확하고 따라하기 쉬운 안내)",
  "selfReflectQuestions": [
    "학생 스스로 자신의 글을 돌아보며 생각을 키울 수 있는 질문 1",
    "학생 스스로 답해보며 내용을 채울 수 있는 질문 2"
  ]
}`;

    const fallback = generateFallbackFeedback(safeDraft, planning, grade);

    try {
      const response = await generateContentWithFallback(prompt);
      const parsed = parseJsonSafely(response.text, null);

      if (parsed && typeof parsed === 'object') {
        const sanitized = {
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0
            ? parsed.strengths.map((s: any) => String(s))
            : fallback.strengths,
          improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0
            ? parsed.improvements.map((s: any) => String(s))
            : fallback.improvements,
          reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
            ? parsed.reasoning
            : (typeof parsed.reasoning === 'object' ? JSON.stringify(parsed.reasoning) : fallback.reasoning),
          topPriority: typeof parsed.topPriority === 'string' && parsed.topPriority.trim().length > 0
            ? parsed.topPriority
            : (typeof parsed.topPriority === 'object' ? JSON.stringify(parsed.topPriority) : fallback.topPriority),
          selfReflectQuestions: Array.isArray(parsed.selfReflectQuestions) && parsed.selfReflectQuestions.length > 0
            ? parsed.selfReflectQuestions.map((q: any) => String(q))
            : fallback.selfReflectQuestions
        };
        return res.json({ success: true, feedback: sanitized, model: response.model });
      }
    } catch (apiErr: any) {
      console.warn('Gemini feedback generation failed, generating smart pedagogical fallback:', apiErr?.message);
    }

    // Smart fallback if all model calls temporarily fail
    return res.json({ success: true, feedback: fallback, isFallback: true });
  } catch (err: any) {
    console.error('Feedback error:', err);
    try {
      const fallback = generateFallbackFeedback(req.body?.draft || '', req.body?.planning, req.body?.grade || 4);
      return res.json({ success: true, feedback: fallback, isFallback: true });
    } catch {
      const errMsg = typeof err?.message === 'string' ? err.message : 'AI 피드백 생성에 실패했습니다.';
      return res.status(500).json({
        success: false,
        error: errMsg
      });
    }
  }
});

// 5. Proofreading & Spacing check
// 규정: 학생의 생각과 내용을 바꾸지 않고 맞춤법, 띄어쓰기, 문장 부호, 명백한 오타만 점검
// 검사 전 글과 검사 후 글을 모두 저장하고, 학생이 수정 제안을 개별 또는 전체 적용할 수 있게 하세요.
app.post(['/api/gemini/proofread', '/api/gemini/proofread/'], async (req, res) => {
  try {
    const { text, grade = 4 } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: '검사할 글을 입력해주세요.' });
    }

    const prompt = `당신은 초등학교 한국어 맞춤법 및 띄어쓰기 검사기입니다.
초등학교 ${grade}학년 학생이 작성한 글을 검사해주세요.

[절대 원칙]:
1. 학생의 생각, 단어 선택, 표현 스타일, 문장 구조, 내용을 절대 바꾸거나 윤문하지 마세요!
2. 오직 다음 항목만 교정하세요:
   - 한글 맞춤법 오류
   - 띄어쓰기 오류
   - 문장 부호 오류 (마침표, 쉼표, 물음표, 느낌표)
   - 명백한 오타 및 탈자
3. 각 교정 항목마다 원본 단어(original), 바른 표기(corrected), 초등학생이 이해하기 쉬운 이유(reason)를 명시하세요.
4. 모든 교정 사항을 적용한 완성된 교정본(afterProofreading)을 함께 생성하세요.
5. 순수 JSON 형식으로만 응답하세요:
{
  "beforeProofreading": ${JSON.stringify(text)},
  "afterProofreading": "모든 맞춤법, 띄어쓰기, 문장 부호 교정이 반영된 최종 글 (내용은 원본과 동일)",
  "suggestions": [
    {
      "id": "item_1",
      "original": "원본 틀린 부분",
      "corrected": "바르게 고친 부분",
      "type": "맞춤법",
      "reason": "초등학생이 쉽게 이해할 수 있는 친절한 설명"
    }
  ]
}

[학생의 글]:
${text}`;

    const response = await generateContentWithFallback(prompt);
    const parsed = parseJsonSafely(response.text, {});
    res.json({
      success: true,
      beforeProofreading: text,
      afterProofreading: parsed.afterProofreading || text,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    });
  } catch (err: any) {
    console.error('Proofread error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '맞춤법 검사에 실패했습니다.'
    });
  }
});

// 6. Teacher Process-focused Assessment Draft (과정중심평가 초안 생성)
app.post(['/api/gemini/process-assessment', '/api/gemini/process-assessment/'], async (req, res) => {
  try {
    const { studentName, grade = 4, record } = req.body;
    if (!record) {
      return res.status(400).json({ success: false, error: '글쓰기 기록이 필요합니다.' });
    }

    const prompt = `당신은 초등학교 국어과 과정중심평가 전문 교사입니다.
한 학생이 [계획 → 초고 → AI 피드백 수용 → 수정 목표 수립 → 고쳐쓰기 → 자기평가 → 맞춤법 교정 → 최종 완성]의 전체 글쓰기 순환 과정을 완수했습니다.
학생의 성장 과정 전체를 다각도로 분석하여 교사용 '과정중심평가 초안'을 작성해 주세요.

[학생 정보]: ${studentName || '학생'} (${grade}학년)
[글쓰기 주제]: ${record.topicTitle}

[1. 글쓰기 계획]:
${JSON.stringify(record.planning || {}, null, 2)}

[2. 초고 (Draft)]:
${record.draft || '(초고 없음)'}

[3. AI 피드백 요약]:
${record.aiFeedback ? JSON.stringify(record.aiFeedback, null, 2) : '피드백 없음'}

[4. 학생이 설정한 수정 목표]:
${record.revisionGoal || '미작성'}

[5. 고쳐쓴 글 (Revised)]:
${record.revisedWriting || '미작성'}

[6. 자기평가]:
${record.selfAssessment ? JSON.stringify(record.selfAssessment, null, 2) : '미작성'}

[7. 맞춤법 점검 및 최종 완성본 (Final)]:
${record.finalWriting || record.revisedWriting || record.draft || ''}

[평가 작성 지침]:
- 초고에서 최종 완성본으로 나아가는 과정에서의 '실질적인 변화와 성장 지점'을 명확히 서술하세요.
- 피드백을 어떻게 소화하고 수정 목표를 반영했는지 태도와 사고력 성장을 평가하세요.
- 학교생활기록부(행동특성 및 교과학습발달상황) 국어과 세부능력 및 특기사항 양식에 부합하는 정중하고 전문적인 문체(~함, ~를 성실히 수행함)로 작성하세요.
- 총 400~600자 내외로 알차게 구성하세요.

반드시 다음 순수 JSON 형식으로 응답하세요:
{
  "summary": "학생의 성장 핵심 요약 (한 문장)",
  "processAssessmentDraft": "계획, 초고 수정, 자기성찰 과정이 종합된 학교생활기록부용 과정중심 서술형 평가문 초안",
  "strengthsObserved": ["관찰된 역량 1", "관찰된 역량 2"],
  "nextStepSuggestion": "향후 발전을 위한 맞춤 조언 (교사 참고용)"
}`;

    const response = await generateContentWithFallback(prompt);
    const parsed = parseJsonSafely(response.text, {});
    res.json({
      success: true,
      aiAssessmentDraft: parsed.processAssessmentDraft || response.text,
      assessmentDetails: parsed
    });
  } catch (err: any) {
    console.error('Assessment draft error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '과정중심평가 초안 생성에 실패했습니다.'
    });
  }
});

// Fallback 404 handler for all unknown /api routes (ensures JSON response instead of HTML)
app.all(['/api/*', '/api'], (req, res) => {
  res.status(404).json({
    success: false,
    error: `요청하신 API 경로(${req.method} ${req.originalUrl})를 찾을 수 없습니다.`
  });
});

// Vite & Static Asset Handling
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupViteOrStatic();

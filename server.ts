import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// High-speed, high-availability Gemini models with automatic failover
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

app.use(express.json({ limit: '10mb' }));

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

// Universal robust generateContent with multi-model fallback
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
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          responseMimeType: config?.responseMimeType || 'application/json'
        }
      });
      console.log(`[Gemini] Model ${model} responded in ${Date.now() - startTime}ms`);

      if (response && response.text) {
        return { text: response.text, model };
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
  const wordCount = draft.trim().split(/\s+/).length;
  const sentenceCount = (draft.match(/[.!?]/g) || []).length || 1;
  const title = planning?.title || '나의 이야기';

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    candidateModels: CANDIDATE_MODELS
  });
});

// 2. Gemini connection test
app.post('/api/gemini/test', async (req, res) => {
  try {
    const result = await generateContentWithFallback(
      '초등학생을 위한 따뜻한 한 줄 환영 인사를 30자 이내로 써주세요.',
      { responseMimeType: 'text/plain' }
    );
    res.json({
      success: true,
      message: result.text.trim() || 'Gemini 연결 성공!',
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

// 2-1. Picture Book Story Ideas Generation (학생의 첫 문장 및 이전 단계 설정에 맞춘 3가지 아이디어 예시 생성)
// Dynamic fallback for story ideas tailored to student's first sentence
function generateDynamicStoryIdeas(
  stage: string,
  currentData: Record<string, any> = {},
  grade: number = 4
): Array<{ id: string; title: string; description: string; preview: string }> {
  const fs = (currentData.firstSentence || '').trim();
  const shortFs = fs.length > 25 ? `${fs.slice(0, 25)}...` : fs;

  if (fs) {
    if (stage === 'character') {
      return [
        {
          id: 'dyn_ch_1',
          title: '첫 문장의 주인공',
          description: `"${shortFs}"의 사건을 직접 마주한 용기 있고 호기심 많은 주인공이에요.`,
          preview: `그 순간 자리에 서 있던 주인공은 평소 호기심이 많고 무슨 일이든 끝까지 파헤치는 특별한 성격을 지니고 있었다.`
        },
        {
          id: 'dyn_ch_2',
          title: '비밀을 품은 친구',
          description: `첫 문장의 상황에 대해 남모를 단서를 품고 있는 신비로운 캐릭터예요.`,
          preview: `겉모습은 평범해 보이지만 첫 문장에서 벌어진 일의 비밀을 가슴속에 간직한 채 조용히 관찰하던 주인공이었다.`
        },
        {
          id: 'dyn_ch_3',
          title: '엉뚱한 해결사',
          description: `기발한 상상력으로 상황을 흥미진진하게 이끌어갈 유쾌한 주인공이에요.`,
          preview: `엉뚱한 생각으로 주변을 놀라게 하지만 위기의 순간마다 번뜩이는 아이디어를 내는 매력적인 주인공이었다.`
        }
      ];
    }
    if (stage === 'goal') {
      return [
        {
          id: 'dyn_gl_1',
          title: '진실 밝히기',
          description: `"${shortFs}"에서 벌어진 신기한 일의 원인을 알아내려는 목표예요.`,
          preview: `방금 일어난 기묘한 사건의 비밀을 풀고 잃어버린 소중한 것을 제자리로 되돌려놓는 것이었다.`
        },
        {
          id: 'dyn_gl_2',
          title: '모험과 탐험',
          description: `첫 문장의 사건을 계기로 미지의 세계로 당당하게 나아가는 목표예요.`,
          preview: `두려움을 이겨내고 한 번도 가보지 못한 새로운 세상으로 나아가 꿈꾸던 소망을 이루는 것이었다.`
        },
        {
          id: 'dyn_gl_3',
          title: '친구와의 약속',
          description: `첫 문장의 상황에서 위험에 빠진 존재를 구하거나 약속을 지키는 목표예요.`,
          preview: `소중한 친구를 안전하게 구하고 가슴속에 품은 따뜻한 약속을 끝까지 지켜내는 것이었다.`
        }
      ];
    }
    if (stage === 'obstacle') {
      return [
        {
          id: 'dyn_ob_1',
          title: '갑작스러운 돌발 상황',
          description: `"${shortFs}" 이후 예상치 못한 장애물이 나타나 앞을 가로막는 상황이에요.`,
          preview: `목표를 향해 나아가려는 순간, 거센 돌풍과 함께 아무도 예상하지 못했던 거대한 장벽이 눈앞을 가로막았다.`
        },
        {
          id: 'dyn_ob_2',
          title: '방해하는 훼방꾼',
          description: `첫 문장의 비밀을 빼앗으려는 짓궂은 상대가 나타나는 전개예요.`,
          preview: `비밀을 호시탐탐 노리던 짓궂은 방해꾼이 나타나 중요한 단서를 낚아채 달아나버렸다.`
        },
        {
          id: 'dyn_ob_3',
          title: '마음의 두려움과 오해',
          description: `스스로의 두려움이나 친구와의 오해로 갈등이 깊어지는 상황이에요.`,
          preview: `시간이 촉박해질수록 자꾸만 실수가 이어졌고, 친구와의 사소한 오해까지 겹쳐 마음이 무거워졌다.`
        }
      ];
    }
    if (stage === 'helper') {
      return [
        {
          id: 'dyn_hp_1',
          title: '믿음직한 조력자',
          description: `위기의 순간 지혜로운 조언을 건네는 든든한 친구예요.`,
          preview: `위기의 순간 어디선가 나타난 작은 친구가 따뜻한 손을 내밀며 결정적인 힌트를 속삭여주었다.`
        },
        {
          id: 'dyn_hp_2',
          title: '신비한 마법 도구',
          description: `첫 문장의 상황을 뒤집을 수 있는 특별한 물건이에요.`,
          preview: `주머니 깊숙한 곳에서 발견한 낡은 나침반이 반짝이는 빛을 내뿜으며 올바른 방향을 가리키기 시작했다.`
        },
        {
          id: 'dyn_hp_3',
          title: '숨겨진 나의 용기',
          description: `어려움 속에서 스스로 깨달은 내면의 힘이에요.`,
          preview: `도망치고 싶던 순간, 포기하지 않겠다고 다짐하자 마음 깊은 곳에서 뜨거운 용기가 솟아올랐다.`
        }
      ];
    }
    if (stage === 'resolution') {
      return [
        {
          id: 'dyn_rs_1',
          title: '기지와 협동으로 해결',
          description: `친구와 힘을 합쳐 번뜩이는 아이디어로 시련을 극복하는 장면이에요.`,
          preview: `친구와 눈빛을 교환한 주인공은 기발한 작전을 펼쳐 방해물을 슬기롭게 뛰어넘었다.`
        },
        {
          id: 'dyn_rs_2',
          title: '진심 어린 설득',
          description: `싸우지 않고 진심을 전해 갈등을 눈 녹듯 푸는 장면이에요.`,
          preview: `솔직한 마음을 담은 따뜻한 한마디를 건네자, 굳게 닫혀 있던 상대방의 마음이 사르르 열렸다.`
        },
        {
          id: 'dyn_rs_3',
          title: '용기 있는 도전',
          description: `두려움을 딛고 온 힘을 다해 문제를 해결하는 통쾌한 장면이에요.`,
          preview: `심호흡을 한 번 크게 내쉬고 온 힘을 다해 손을 뻗어 마침내 엉킨 문제를 말끔히 풀어냈다.`
        }
      ];
    }
    if (stage === 'ending') {
      return [
        {
          id: 'dyn_ed_1',
          title: '따뜻한 감동의 마무리',
          description: `모험이 끝나고 마음이 한 뼘 더 자란 훈훈한 결말이에요.`,
          preview: `모든 모험이 끝나고 일상으로 돌아왔지만, 주인공의 가슴속에는 잊을 수 없는 소중한 추억과 우정이 영원히 남게 되었다.`
        },
        {
          id: 'dyn_ed_2',
          title: '새로운 모험의 여운',
          description: `또 다른 신비로운 모험을 예고하며 미소 짓는 결말이에요.`,
          preview: `창밖의 노을을 바라보며 미소를 지었다. 내일은 또 어떤 흥미진진한 비밀이 나를 기다리고 있을까?`
        },
        {
          id: 'dyn_ed_3',
          title: '유쾌하고 흐뭇한 반전',
          description: `친구들과 함께 활짝 웃으며 행복하게 끝나는 결말이에요.`,
          preview: `서로의 얼굴을 마주 보며 까르르 웃음을 터뜨렸다. 오늘은 우리 모두에게 평생 잊지 못할 가장 특별한 날이었다.`
        }
      ];
    }
  }

  return [
    {
      id: 'open_1',
      title: '신비한 일상 판타지',
      description: '평범한 하루 속에 마법 같은 일이 벌어지는 호기심 가득한 오프닝이에요.',
      preview: '비가 그친 오후, 낡은 책상 서랍 구석에서 은은한 빛과 함께 작은 문이 딸깍 열렸다.'
    },
    {
      id: 'open_2',
      title: '유쾌하고 엉뚱한 반전',
      description: '예상치 못한 사건으로 웃음과 재미를 선사하는 오프닝이에요.',
      preview: '아침에 일어났더니, 침대 머리맡에 놓인 내 파란색 운동화가 사람처럼 하품을 하고 있었다.'
    },
    {
      id: 'open_3',
      title: '두근두근 모험의 시작',
      description: '비밀 통로나 신비한 메시지를 발견하며 시작되는 오프닝이에요.',
      preview: '학교 운동장 시계탑 뒤편에서 지금까지 아무도 보지 못했던 은빛 비밀 계단이 모습을 드러냈다.'
    }
  ];
}

// 2-1. Picture Book Story Ideas Generation (학생의 첫 문장 및 이전 단계 설정에 맞춘 3가지 아이디어 예시 생성)
app.post('/api/gemini/story-ideas', async (req, res) => {
  try {
    const { stage, currentData = {}, grade = 6, topicTitle } = req.body;

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
    const studentFirstSentence = currentData.firstSentence ? currentData.firstSentence.trim() : '';

    let prompt = '';

    if (stage === 'firstSentence') {
      prompt = `당신은 대한민국 최고의 초등학교 그림책 및 동화 창작 전문 작가이자 국어 지도 교사입니다.
초등학교 ${grade}학년 학생이 그림책을 쓰기 위해 '이야기를 여는 첫 문장' 아이디어를 얻고자 합니다.
${topicTitle ? `[학생이 고른 주제]: ${topicTitle}` : ''}
${studentFirstSentence ? `[학생의 기존 생각/단어]: "${studentFirstSentence}"` : ''}

★★ [절대 원칙 - 천편일률적 클리셰 금지 및 다양성 극대화] ★★
1. **절대로 모든 학생에게 동일하거나 뻔한 동화 클리셰(흔한 다람쥐 도토리, 숲속 요정, 뻔한 먹구름 등)를 반복해서 추천하지 마세요.**
2. 독자(친구들, 부모님)의 눈을 단숨에 사로잡고 "어? 다음엔 무슨 일이 일어나지?" 하고 호기심이 폭발하는 참신하고 기발한 첫 문장 3가지를 만들어주세요.
3. 3가지 첫 문장은 서로 완전히 다른 장르와 분위기를 띠어야 합니다:
   - 아이디어 1 (기발한 일상 판타지): 평범한 일상(교실, 방, 운동장, 냉장고, 가방, 빗방울 등)에 갑자기 마법 같은 일이 벌어지는 신비로운 오프닝
   - 아이디어 2 (유쾌하고 엉뚱한 유머/반전): 예상치 못한 인물이나 사물의 행동, 엉뚱한 상황으로 웃음을 터뜨리는 오프닝
   - 아이디어 3 (두근두근 모험/미스터리/SF): 비밀 통로, 시간 여행, 우주, 신비한 소리나 암호 등 가슴 뛰는 모험의 오프닝
4. 초등학교 ${grade}학년 어린이 눈높이에 맞추어 이해하기 쉽고 바로 상상이 펼쳐지는 문장이어야 합니다.

반드시 다음 JSON 형식으로만 응답해 주세요 (코드블록 마크다운 제외):
{
  "stage": "firstSentence",
  "suggestions": [
    {
      "id": "idea_1",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 바꿔 쓸 수 있는 완성도 높은 첫 문장"
    },
    {
      "id": "idea_2",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 조금만 바꿔 쓸 수 있는 완성도 높은 첫 문장"
    },
    {
      "id": "idea_3",
      "title": "호기심을 끄는 제목 (12자 이내)",
      "description": "이 첫 문장이 왜 매력적인지 아이에게 설명 (친절한 해요체, 1~2문장)",
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
초등학교 ${grade}학년 학생이 자신의 그림책을 만들기 위해 이야기 씨앗을 심고 있습니다.

지금 작성할 단계: [${targetStageName}]

[현재까지 학생이 확정한 이야기 내용]:
${contextDesc || '(아직 앞 단계 내용이 없습니다.)'}

★★ [가장 중요한 핵심 중심축 지침] ★★
1. **[학생의 첫 문장]을 이야기의 절대적인 세계관 중심축(Anchor)으로 삼으세요!**
   - 학생의 첫 문장: "${studentFirstSentence || '첫 문장 미작성'}"
   ${studentFirstSentence ? `- 학생이 작성한 고유한 첫 문장의 구체적인 소재, 단어, 공간, 인물 힌트, 분위기, 세계관을 100% 반영해야 합니다.
   - [적용 예시]:
     * 첫 문장이 "자전거 페달을 세게 밟았더니 하늘로 날아올랐다"라면: 추천하는 [${targetStageName}]은 반드시 날아다니는 자전거, 하늘 구름길, 바람의 세계관과 필연적으로 맞물려야 합니다.
     * 첫 문장이 "우리 집 냉장고 문을 열었더니 펭귄이 아이스크림을 먹고 있었다"라면: 추천하는 [${targetStageName}]은 반드시 냉장고 속 얼음 세상, 펭귄, 차가운 비밀과 맞물려야 합니다.
     * 첫 문장이 "교실 창밖으로 거대한 분홍빛 고래가 헤엄쳐 지나갔다"라면: 추천하는 [${targetStageName}]은 분홍빛 고래, 하늘 바다, 교실 속 비밀과 맞물려야 합니다.` : '- 첫 문장이 아직 없다면, 초등학생들이 흥미를 느낄 만한 다채롭고 참신한 아이디어를 제안해 주세요.'}
2. **절대로 모든 학생에게 똑같은 동화 클리셰(무관한 아기 다람쥐 도토리, 숲속 요정, 뻔한 먹구름 등)를 반복해서 추천하지 마세요.** 학생의 첫 문장과 무관한 제안은 엄격히 금지됩니다.
3. 3가지 아이디어는 모두 첫 문장과 긴밀히 연결되되, 전개 방향을 다르게 하세요:
   - 아이디어 1 (신비로운 모험/판타지): 첫 문장의 비밀을 찾아 떠나는 흥미진진한 전개
   - 아이디어 2 (기발하고 엉뚱한 유머/반전): 첫 문장의 상황에서 터져 나오는 유쾌한 소동과 반전
   - 아이디어 3 (따뜻한 감동/우정/성장): 첫 문장의 사건이나 인물과 교감하며 성장하는 포근한 전개
4. 각 제안의 'preview'는 초등학교 ${grade}학년 어린이가 그대로 선택하거나 자신의 생각대로 쉽게 수정할 수 있는 완성도 높은 자연스러운 구체적 문장이어야 합니다.

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
      const response = await generateContentWithFallback(prompt, {
        temperature: 0.95,
        topP: 0.95
      });
      const parsed = parseJsonSafely(response.text, {});
      if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
        return res.json({
          success: true,
          stage,
          suggestions: parsed.suggestions,
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
app.post('/api/gemini/outline-examples', async (req, res) => {
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
app.post('/api/gemini/topics', async (req, res) => {
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
app.post('/api/gemini/feedback', async (req, res) => {
  try {
    const { topicTitle, draft, planning, grade = 4 } = req.body;
    if (!draft || draft.trim().length === 0) {
      return res.status(400).json({ success: false, error: '초고 내용을 입력해주세요.' });
    }

    const prompt = `당신은 초등학교 글쓰기 전문 선생님입니다.
초등학교 ${grade}학년 어린이가 쓴 초고를 읽고, 아이의 글쓰기 동기를 북돋우고 구체적으로 발전시킬 수 있는 따뜻하고 건설적인 피드백을 제공해 주세요.

[글 주제]: ${topicTitle || '자유 주제'}
[학생 글쓰기 계획]:
- 제목: ${planning?.title || '미정'}
- 글의 목적/종류: ${planning?.genre || '생활문'}
- 전달하고 싶은 중심 생각: ${planning?.ideas?.join(', ') || '없음'}

[학생의 실제 초고]:
${draft}

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

    try {
      const response = await generateContentWithFallback(prompt);
      const parsed = parseJsonSafely(response.text, null);

      if (parsed && typeof parsed === 'object') {
        const hasStrengths = Array.isArray(parsed.strengths) && parsed.strengths.length > 0;
        if (hasStrengths) {
          return res.json({ success: true, feedback: parsed, model: response.model });
        }
        // If parsed is valid JSON but strengths is missing or formatted differently
        return res.json({
          success: true,
          feedback: {
            ...generateFallbackFeedback(draft, planning, grade),
            ...parsed
          },
          model: response.model
        });
      }
    } catch (apiErr: any) {
      console.warn('Gemini feedback generation failed, generating smart pedagogical fallback:', apiErr?.message);
    }

    // Smart fallback if all model calls temporarily fail
    const fallback = generateFallbackFeedback(draft, planning, grade);
    res.json({ success: true, feedback: fallback, isFallback: true });
  } catch (err: any) {
    console.error('Feedback error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'AI 피드백 생성에 실패했습니다.'
    });
  }
});

// 5. Proofreading & Spacing check
// 규정: 학생의 생각과 내용을 바꾸지 않고 맞춤법, 띄어쓰기, 문장 부호, 명백한 오타만 점검
// 검사 전 글과 검사 후 글을 모두 저장하고, 학생이 수정 제안을 개별 또는 전체 적용할 수 있게 하세요.
app.post('/api/gemini/proofread', async (req, res) => {
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
app.post('/api/gemini/process-assessment', async (req, res) => {
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

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
const MODEL_NAME = 'gemini-3.6-flash';

app.use(express.json({ limit: '10mb' }));

// Helper to get Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 환경변수에 설정되어 있지 않습니다.');
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY
  });
});

// 2. Gemini connection test
app.post('/api/gemini/test', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: '초등학생을 위한 따뜻한 한 줄 환영 인사를 30자 이내로 써주세요.',
    });
    res.json({
      success: true,
      message: response.text?.trim() || 'Gemini 연결 성공!',
      model: MODEL_NAME
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
app.post('/api/gemini/story-ideas', async (req, res) => {
  try {
    const { stage, currentData = {}, grade = 6 } = req.body;
    const ai = getGeminiClient();

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

    let contextDesc = '';
    if (currentData.firstSentence) contextDesc += `\n- [학생이 직접 쓴 첫 문장]: "${currentData.firstSentence}"`;
    if (currentData.character) contextDesc += `\n- 1. 주인공: "${currentData.character}"`;
    if (currentData.goal) contextDesc += `\n- 2. 하고 싶은 일: "${currentData.goal}"`;
    if (currentData.obstacle) contextDesc += `\n- 3. 주인공을 방해하는 것: "${currentData.obstacle}"`;
    if (currentData.helper) contextDesc += `\n- 4. 주인공을 돕는 것: "${currentData.helper}"`;
    if (currentData.resolution) contextDesc += `\n- 5. 해결과정: "${currentData.resolution}"`;
    if (currentData.ending) contextDesc += `\n- 6. 결말: "${currentData.ending}"`;

    const studentFirstSentence = currentData.firstSentence ? currentData.firstSentence.trim() : '';

    const prompt = `당신은 초등학교 그림책 창작 전문 동화 작가이자 국어 지도 교사입니다.
초등학교 ${grade}학년 학생이 자신의 그림책을 만들기 위해 이야기 씨앗을 심고 있습니다.

지금 작성할 단계: [${targetStageName}]

[현재까지 학생이 확정한 이야기 내용]:
${contextDesc || '(아직 앞 단계 내용이 없습니다. 아이들이 호기심을 가질 만한 멋진 아이디어를 제안해 주세요.)'}

★★ [가장 중요한 핵심 지침] ★★
1. 학생이 작성한 첫 문장("${studentFirstSentence || '없음'}")을 반드시 깊이 있게 분석하세요!
2. **절대로 모든 학생에게 천편일률적인 뻔한 동화 클리셰(다람쥐 도토리, 숲속 요정, 흔한 먹구름 등)를 반복해서 추천하지 마세요.**
3. 반드시 학생이 작성한 [첫 문장]의 분위기, 등장인물/동물/사물/장소/사건(예: 바다, 우주, 학교, 마법, 로봇, 시간 여행, 비밀 등)과 긴밀하고 필연적으로 이어지는 창의적인 [${targetStageName}] 아이디어 3가지를 제안해야 합니다.
4. 3가지 아이디어는 각각 서로 다른 흥미로운 전개 방향(예: 신비로운 판타지/모험, 엉뚱하고 기발한 유머, 따뜻하고 감동적인 성장)을 띠도록 다채롭게 구성해 주세요.
5. 초등학교 ${grade}학년 어린이가 혼자서도 쉽게 고쳐 쓸 수 있도록 친근하고 명확한 문장으로 작성해주세요.

반드시 다음 JSON 형식으로만 응답해 주세요 (코드블록 백틱 없이 순수 JSON 문자열만 출력):
{
  "stage": "${stage}",
  "suggestions": [
    {
      "id": "idea_1",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 자신의 생각에 맞춰 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    },
    {
      "id": "idea_2",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 자신의 생각에 맞춰 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    },
    {
      "id": "idea_3",
      "title": "첫 문장에 맞춘 매력적인 제목 (12자 이내)",
      "description": "첫 문장의 상황과 연결되는 이유 설명 (친절한 해요체, 1~2문장)",
      "preview": "학생이 그대로 선택하거나 자신의 생각에 맞춰 조금만 고쳐 쓸 수 있는 완성도 높은 구체적 문장"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    res.json({
      success: true,
      stage,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
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
    const ai = getGeminiClient();

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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());
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
    const ai = getGeminiClient();

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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '[]';
    const parsed = JSON.parse(responseText.trim());
    res.json({ success: true, topics: parsed });
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

    const ai = getGeminiClient();

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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    res.json({ success: true, feedback: parsed });
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

    const ai = getGeminiClient();

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
      "type": "맞춤법" | "띄어쓰기" | "문장부호" | "오타",
      "reason": "초등학생이 쉽게 이해할 수 있는 친절한 설명 (예: '되요'가 아니라 '돼요(되어요)'가 맞아요)"
    }
  ]
}

[학생의 글]:
${text}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    res.json({
      success: true,
      beforeProofreading: text,
      afterProofreading: parsed.afterProofreading || text,
      suggestions: parsed.suggestions || []
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
// 규정: 계획, 초고, AI 피드백, 수정 목표, 고쳐쓰기, 자기평가, 맞춤법 수정, 최종 글을 모두 분석하여 평가 초안 생성
// AI 평가 결과는 반드시 초안으로 저장하고, 교사가 수정·승인한 뒤 최종 평가로 사용
app.post('/api/gemini/process-assessment', async (req, res) => {
  try {
    const { studentName, grade = 4, record } = req.body;
    if (!record) {
      return res.status(400).json({ success: false, error: '글쓰기 기록이 필요합니다.' });
    }

    const ai = getGeminiClient();

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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    res.json({
      success: true,
      aiAssessmentDraft: parsed.processAssessmentDraft || responseText,
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

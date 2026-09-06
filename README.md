# AI와 함께하는 글쓰기 성장 (초등 글쓰기 지도 플랫폼)

초등학생을 위한 그림책(동화책) 만들기, 첫 문장과 6대 이야기 요소 작성, Gemini 맞춤형 아이디어 추천 및 단계별 피드백 웹 애플리케이션입니다.

---

## 🚀 Vercel 배포 가이드 (Gemini API 정상 연동)

이 프로젝트는 **Cloud Run (AI Studio)** 환경과 **Vercel (GitHub 연동)** 환경 모두에서 완벽하게 작동하도록 서버리스 아키텍처가 구성되어 있습니다.

### 1. 깃허브(GitHub)로 내보내기
- AI Studio 상단 메뉴의 **Export to GitHub** (또는 공유/내보내기)를 통해 본인의 GitHub 저장소로 코드를 푸시합니다.

### 2. Vercel에서 프로젝트 가져오기 (Import)
1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인합니다.
2. **Add New...** > **Project**를 클릭하고 방금 내보낸 GitHub 저장소를 선택(**Import**)합니다.
3. Framework Preset은 **Vite**로 자동 감지됩니다. (기본 설정 그대로 유지)

### 3. 필수 환경변수(Environment Variables) 설정 ⚠️ (중요)
Vercel 배포 시 Gemini AI가 정상 동작하려면 **Google AI Studio에서 발급받은 Gemini API 키**를 Vercel 환경 변수에 등록해야 합니다.

1. 배포 설정 화면의 **Environment Variables** 섹션(또는 배포 후 Project Settings > Environment Variables)으로 이동합니다.
2. 다음 환경 변수를 추가합니다:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `발급받은_Gemini_API_Key` (예: `AIzaSy...`)
3. `Save`를 눌러 저장합니다.

> 💡 **참고**: 실수로 `VITE_GEMINI_API_KEY`로 입력한 경우에도 서버에서 호환되도록 처리되어 있습니다.

### 4. 배포 (Deploy)
- **Deploy** 버튼을 누르면 약 1분 이내에 배포가 완료됩니다.
- 배포된 URL로 접속하여 교사 대시보드의 **[AI 단독 테스트]** 또는 학생 글쓰기 화면에서 **[AI 피드백 요청하기]**, **[AI 생각 꺼내기]**가 원활히 작동하는지 확인하세요!

---

## 🛠️ Vercel 배포 시 Gemini API 오류가 발생했던 원인 및 해결 내용

1. **Vercel 서버리스 진입점 부재 해결**:
   - Vercel은 정적 SPA(Vite) 빌드 결과물(`dist`)만 배포하고 기존 `server.ts`의 백엔드 프로세스를 실행하지 않는 구조였습니다.
   - `api/index.ts`를 생성하여 Vercel Serverless Functions가 Express 백엔드 API를 서버리스로 자동 구동하도록 구현했습니다.
2. **라우팅 리라이트 (`vercel.json`) 추가**:
   - `/api/*`로 들어오는 모든 API 요청은 `api/index.ts`로 라우팅하고, 그 외의 프론트엔드 라우트는 SPA `index.html`로 안전하게 리다이렉트하도록 설정했습니다.
3. **서버리스 환경 충돌 방지**:
   - Vercel 환경(`process.env.VERCEL`)에서는 불필요한 포트 바인딩(`app.listen`)과 무거운 개발용 Vite 미들웨어를 건너뛰고 Express 인스턴스만 Vercel에 위임하도록 수정했습니다.
4. **API 키 누락 시 친절한 안내 제공**:
   - Vercel 프로젝트 환경 변수에 키가 등록되지 않았을 경우, 모호한 500 에러 대신 Vercel 대시보드에서 등록할 수 있는 직관적인 한글 안내 메시지를 반환합니다.

# HabitFlow 🌱

매일 습관을 추적하고 성장하는 앱. Google Drive 백업 지원.

## 기능

- ✅ 습관 추가 / 수정 / 삭제
- 🔥 스트릭 & 통계 추적
- ☁️ Google Drive 자동 동기화
- 📤 JSON 내보내기 / 가져오기
- 🗑️ 데이터 초기화
- 🔗 앱 공유하기
- 📱 오프라인 지원 (PWA)

---

## 배포 방법

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. **API 및 서비스 > 라이브러리** 에서 다음 2개 활성화:
   - `Google Drive API`
   - `Google Identity` (자동 포함)
4. **API 및 서비스 > 사용자 인증 정보**
   - `OAuth 2.0 클라이언트 ID` 생성
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본에 추가:
     ```
     https://YOUR_USERNAME.github.io
     http://localhost:8080  (로컬 테스트용)
     ```
5. 생성된 **클라이언트 ID** 복사

### 2. CLIENT_ID 설정

`js/auth.js` 파일 상단:

```js
export const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
//                        ↑ 여기에 복사한 클라이언트 ID 붙여넣기
```

### 3. GitHub Pages 배포

```bash
git init
git add .
git commit -m "🌱 HabitFlow 초기 배포"
git remote add origin https://github.com/YOUR_USERNAME/habitflow.git
git push -u origin main
```

GitHub 저장소 설정:
- **Settings > Pages > Source**: `main` 브랜치, `/ (root)` 폴더

배포 URL: `https://YOUR_USERNAME.github.io/habitflow/`

---

## 로컬 테스트

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

→ `http://localhost:8080` 접속

---

## 파일 구조

```
habitflow/
├── index.html          # 메인 HTML
├── manifest.json       # PWA 매니페스트
├── css/
│   └── style.css       # 전체 스타일
├── js/
│   ├── app.js          # 메인 진입점 (이벤트 바인딩)
│   ├── store.js        # 데이터 저장 (로컬 + Drive)
│   ├── auth.js         # Google 로그인
│   └── ui.js           # UI 렌더링
└── icons/              # PWA 아이콘 (선택)
    ├── icon-192.png
    └── icon-512.png
```

---

## Google Drive 동작 방식

- `appDataFolder` (앱 전용 숨김 폴더) 사용 — 사용자 Drive에 보이지 않음
- 파일명: `habitflow_backup.json`
- 동기화 전략: `lastModified` 타임스탬프 비교 후 최신 데이터 우선
- 로그아웃 시 로컬 데이터는 유지됨

## 주의사항

- GitHub Pages는 HTTPS이므로 Google OAuth 정상 작동
- `module` 타입 스크립트 사용 → IE 미지원 (모던 브라우저만)
- PWA 아이콘은 `icons/` 폴더에 직접 추가 필요

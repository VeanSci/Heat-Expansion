# 🌡️ 열팽창 시뮬레이션

고체 · 액체 · 바이메탈 · 온도계 네 가지 열팽창 실험을 다루는 교육용 React 시뮬레이션입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버가 뜨면 표시되는 주소(보통 http://localhost:5173)를 브라우저에서 엽니다.

## 빌드 (정적 파일 생성)

```bash
npm run build
```

`dist/` 폴더에 정적 파일이 생성됩니다. 이 폴더를 그대로 호스팅하면 됩니다.

## 배포

### Vercel
1. 이 폴더를 GitHub 저장소에 올립니다.
2. Vercel에서 해당 저장소를 Import 합니다.
3. 프레임워크 프리셋: **Vite**, 빌드 명령: `npm run build`, 출력 디렉터리: `dist` (자동 감지됨).

### Netlify
1. GitHub 저장소 연결, 또는 `npm run build` 후 `dist/` 폴더를 드래그 업로드.
2. 빌드 명령: `npm run build`, 게시 디렉터리: `dist`.

## 구조

- `src/ThermalExpansion.jsx` — 시뮬레이션 전체 컴포넌트
- `src/main.jsx` — React 진입점 (위 컴포넌트를 #root에 렌더)
- `index.html` — HTML 진입 파일

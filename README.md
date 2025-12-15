# 한국외대 시간표 시뮬레이션

한국외대 강의/수업 정보를 실시간으로 불러와 원하는 분반을 조합해 볼 수 있는 React + TypeScript + Vite 기반 웹앱입니다.

- 전공/교양/기초, 캠퍼스별 강좌 실시간 조회
- 과목 검색, 요일·학년 필터, 시간 충돌 표시
- 시간표 저장/불러오기, PNG 이미지 내보내기
- 기본 샘플 데이터 + API 데이터를 병행해 빠르게 시작
- 데이터 출처: [한국외대 강의/수업정보 사이트](https://wis.hufs.ac.kr/src08/jsp/lecture/LECTURE2020L.jsp)

## 로컬 실행 가이드

필수: Node.js 18+ (npm 사용)

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 타입체크 + 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview

# 린트
npm run lint
```

## 주요 구조

- `src/App.tsx` : UI, 필터, 시간표 및 저장/내보내기 로직
- `src/api/hufs.ts` : HUFS 강좌·학과 API 호출 래퍼
- `src/data/courses.ts` : 오프라인 기본 샘플 데이터
- `src/assets`, `public/` : 정적 리소스

## 배포 참고

- `npm run build` 후 생성되는 `dist/`를 정적 호스팅에 배포하면 됩니다.
- 실시간 강좌 조회는 외부 HUFS API 네트워크 접근이 필요합니다.

# 분양 홍보 홈페이지

단지 안내와 상담 문의 폼이 있는 한 페이지 홈페이지 (Next.js 16).
문의는 서버 액션이 Supabase `inquiries` 표에 저장합니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # SUPABASE_SECRET_KEY 채우기
npm run dev
```

## 환경 변수

| 이름 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | secret 키 (`sb_secret_…`). 서버에서만 사용, `NEXT_PUBLIC_` 붙이지 말 것 |

Supabase 표는 모두 RLS가 켜져 있고 정책이 없어서 publishable 키로는 읽기·쓰기가 막혀 있습니다.
배포할 때는 Vercel 프로젝트 설정의 Environment Variables에 같은 두 값을 넣습니다.

## 내용 바꾸기

단지명·전화번호·상담 시간·개인정보 문구·타입 정보는 `src/lib/site.ts` 한 곳에서 바꿉니다.

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ADMIN_COOKIE, verifyToken } from "./admin-session";

// 관리자 데이터 접근 전에 반드시 호출한다. proxy의 확인은 낙관적 검사일 뿐이라
// 페이지·서버 액션에서 다시 세션을 검증한다 (Next.js 인증 가이드의 DAL 패턴).
export const verifyAdmin = cache(async () => {
  // 요청 시점에만 렌더링 (세션 만료 확인에 현재 시각을 쓰고, 데이터도 매번 새로 읽는다)
  await connection();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!verifyToken(token)) redirect("/admin/login");
  return { isAdmin: true as const };
});

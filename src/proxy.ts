import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyToken } from "@/lib/admin-session";

// /admin 낙관적 검사: 쿠키 서명만 확인하고 DB는 보지 않는다.
// 실제 데이터 보호는 페이지의 verifyAdmin()이 다시 한다.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = verifyToken(request.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === "/admin/login") {
    return authed ? NextResponse.redirect(new URL("/admin", request.nextUrl)) : NextResponse.next();
  }
  if (!authed) {
    return NextResponse.redirect(new URL("/admin/login", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

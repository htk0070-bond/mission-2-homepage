"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, SESSION_SECONDS, checkPassword, createToken } from "@/lib/admin-session";

export type LoginState = { message: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!process.env.ADMIN_PASSWORD) {
    return { message: "ADMIN_PASSWORD 환경 변수가 설정되지 않아 로그인할 수 없습니다." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    // 무작위 대입을 늦춘다
    await new Promise((r) => setTimeout(r, 600));
    return { message: "비밀번호가 올바르지 않습니다." };
  }

  (await cookies()).set(ADMIN_COOKIE, createToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

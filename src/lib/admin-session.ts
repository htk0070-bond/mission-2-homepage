import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// /admin 비밀번호 게이트용 무상태 세션.
// 쿠키 값 = "만료시각.서명". 서명 키는 ADMIN_PASSWORD에서 파생하므로
// 비밀번호를 바꾸면 기존 세션은 모두 무효가 된다. proxy와 서버 코드가 함께 쓴다.

export const ADMIN_COOKIE = "admin_session";
export const SESSION_SECONDS = 8 * 60 * 60;

function signingKey(password: string) {
  return createHash("sha256").update(`admin-session:${password}`).digest();
}

function sign(payload: string, password: string) {
  return createHmac("sha256", signingKey(password)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = createHash("sha256").update(a).digest();
  const bb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input: string) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  return safeEqual(input, password);
}

export function createToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD 환경 변수가 없습니다.");
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${exp}.${sign(exp, password)}`;
}

export function verifyToken(token: string | undefined) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp, password));
}

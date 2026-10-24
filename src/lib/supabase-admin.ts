import "server-only";
import { createClient } from "@supabase/supabase-js";

// secret 키는 서버에서만 쓴다. 표마다 RLS가 켜져 있고 정책이 없어서
// 브라우저(publishable 키)로는 읽기·쓰기가 모두 막힌다.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경 변수가 없습니다.");
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { UNIT_TYPES } from "@/lib/site";

export type InquiryState = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<"name" | "phone" | "interestType" | "message" | "privacy", string>>;
  // 오류로 돌려보낼 때 입력값을 다시 채우기 위한 값
  values?: { name: string; phone: string; interestType: string; message: string; privacy: boolean };
  // 제출할 때마다 늘어나는 번호. 폼을 새로 그려 select까지 입력값을 되살린다.
  attempt?: number;
};

const TYPES = new Set(UNIT_TYPES.map((t) => t.type));

export async function submitInquiry(prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const attempt = (prev.attempt ?? 0) + 1;
  // 봇이 채우는 숨김 칸. 값이 있으면 저장하지 않고 성공처럼 응답한다.
  if (String(formData.get("website") ?? "").trim()) {
    return { ok: true, message: "문의가 접수되었습니다. 담당자가 곧 연락드리겠습니다." };
  }

  const name = String(formData.get("name") ?? "").trim().replace(/\s*(고객님|님|씨)$/, "");
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
  const interestType = String(formData.get("interestType") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const privacy = formData.get("privacy") === "on";

  const values = { name, phone: String(formData.get("phone") ?? ""), interestType, message, privacy };
  const errors: InquiryState["errors"] = {};
  if (!name) errors.name = "이름을 입력해 주세요.";
  else if (name.length > 50) errors.name = "이름은 50자 이내로 입력해 주세요.";
  if (!/^01[0-9]{9}$/.test(phone)) errors.phone = "휴대폰 번호 11자리를 입력해 주세요. (예: 010-1234-5678)";
  if (interestType && !TYPES.has(interestType)) errors.interestType = "관심 타입을 다시 선택해 주세요.";
  if (message.length > 1000) errors.message = "문의 내용은 1,000자 이내로 입력해 주세요.";
  if (!privacy) errors.privacy = "개인정보 수집·이용에 동의해 주셔야 문의를 접수할 수 있습니다.";
  if (Object.keys(errors).length) {
    return { ok: false, message: "입력 내용을 확인해 주세요.", errors, values, attempt };
  }

  try {
    const { error } = await supabaseAdmin().from("inquiries").insert({
      name,
      phone,
      interest_type: interestType || null,
      message: message || null,
      privacy_agreed: true,
    });
    if (error) throw error;
  } catch (e) {
    console.error("문의 저장 실패:", e);
    return { ok: false, message: "일시적인 오류로 접수하지 못했습니다. 잠시 후 다시 시도하시거나 전화로 문의해 주세요.", values, attempt };
  }

  return { ok: true, message: "문의가 접수되었습니다. 담당자가 곧 연락드리겠습니다." };
}

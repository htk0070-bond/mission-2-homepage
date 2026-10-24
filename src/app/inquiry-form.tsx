"use client";

import { useActionState } from "react";
import { submitInquiry, type InquiryState } from "./actions";
import { SITE, UNIT_TYPES } from "@/lib/site";
import styles from "./page.module.css";

const initialState: InquiryState = { ok: false, message: "" };

export function InquiryForm() {
  const [state, formAction, pending] = useActionState(submitInquiry, initialState);
  const v = state.values;
  const err = state.errors ?? {};

  if (state.ok) {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>문의가 접수되었습니다</p>
        <p>담당자가 영업일 기준 1일 이내에 연락드리겠습니다.</p>
        <p className={styles.muted}>급하신 경우 {SITE.phone} ({SITE.hours})로 전화 주세요.</p>
      </div>
    );
  }

  return (
    <form key={state.attempt ?? 0} action={formAction} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="name">이름 <span className={styles.req}>필수</span></label>
        <input id="name" name="name" autoComplete="name" maxLength={50} required defaultValue={v?.name}
          aria-invalid={!!err.name} aria-describedby={err.name ? "name-err" : undefined} />
        {err.name && <p id="name-err" className={styles.error}>{err.name}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="phone">휴대폰 번호 <span className={styles.req}>필수</span></label>
        <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678"
          required defaultValue={v?.phone} aria-invalid={!!err.phone} aria-describedby={err.phone ? "phone-err" : undefined} />
        {err.phone && <p id="phone-err" className={styles.error}>{err.phone}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="interestType">관심 타입</label>
        <select id="interestType" name="interestType" defaultValue={v?.interestType ?? ""}
          aria-invalid={!!err.interestType} aria-describedby={err.interestType ? "type-err" : undefined}>
          <option value="">아직 정하지 않았어요</option>
          {UNIT_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.type} (전용 {t.area}㎡)</option>
          ))}
        </select>
        {err.interestType && <p id="type-err" className={styles.error}>{err.interestType}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="message">문의 내용</label>
        <textarea id="message" name="message" rows={4} maxLength={1000} defaultValue={v?.message}
          placeholder="궁금하신 점이나 상담 희망 시간을 남겨 주세요."
          aria-invalid={!!err.message} aria-describedby={err.message ? "message-err" : undefined} />
        {err.message && <p id="message-err" className={styles.error}>{err.message}</p>}
      </div>

      {/* 사람에게는 보이지 않는 칸 — 자동 등록 방지 */}
      <div className={styles.hp} aria-hidden="true">
        <label htmlFor="website">웹사이트</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className={styles.privacy}>
        <legend>개인정보 수집·이용 동의</legend>
        <dl>
          <dt>수집 항목</dt><dd>{SITE.privacy.items}</dd>
          <dt>이용 목적</dt><dd>{SITE.privacy.purpose}</dd>
          <dt>보유 기간</dt><dd>{SITE.privacy.retention}</dd>
        </dl>
        <p className={styles.muted}>동의를 거부할 수 있으며, 거부 시 문의 접수가 제한됩니다.</p>
        <label className={styles.check}>
          <input type="checkbox" name="privacy" required defaultChecked={v?.privacy} aria-invalid={!!err.privacy}
            aria-describedby={err.privacy ? "privacy-err" : undefined} />
          <span>위 내용에 동의합니다 <span className={styles.req}>필수</span></span>
        </label>
        {err.privacy && <p id="privacy-err" className={styles.error}>{err.privacy}</p>}
      </fieldset>

      {state.message && !state.ok && <p className={styles.formError} role="alert">{state.message}</p>}

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "접수하는 중…" : "상담 문의하기"}
      </button>
    </form>
  );
}

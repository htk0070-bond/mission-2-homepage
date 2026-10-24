"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";
import styles from "../admin.module.css";

const initialState: LoginState = { message: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className={styles.loginForm}>
      <label htmlFor="password" className={styles.srOnly}>비밀번호</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required
        placeholder="비밀번호" className={styles.input} aria-describedby={state.message ? "login-err" : undefined} />
      {state.message && <p id="login-err" className={styles.error} role="alert">{state.message}</p>}
      <button type="submit" className={styles.primaryBtn} disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}

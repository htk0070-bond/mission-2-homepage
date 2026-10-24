import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

export const metadata: Metadata = {
  title: "관리자 로그인",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>관리자 대시보드</h1>
        <p className={styles.muted}>관리자 비밀번호를 입력하세요.</p>
        <LoginForm />
      </div>
    </main>
  );
}

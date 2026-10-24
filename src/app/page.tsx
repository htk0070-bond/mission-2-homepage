import { InquiryForm } from "./inquiry-form";
import { OVERVIEW, SITE, UNIT_TYPES } from "@/lib/site";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <a href="#top" className={styles.brand}>
            {SITE.name}<span className={styles.brandNote}>{SITE.nameNote}</span>
          </a>
          <nav className={styles.nav} aria-label="주요 메뉴">
            <a href="#overview">단지 개요</a>
            <a href="#types">타입 안내</a>
            <a href="#inquiry" className={styles.navCta}>상담 문의</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.inner}>
            <p className={styles.eyebrow}>분양 상담 접수 중</p>
            <h1 className={styles.heroTitle}>{SITE.tagline}</h1>
            <p className={styles.heroText}>
              3개 동 220세대, 전용 59㎡부터 114㎡까지 7개 타입.
              <br />
              관심 타입과 연락처를 남겨 주시면 담당자가 직접 안내해 드립니다.
            </p>
            <div className={styles.heroActions}>
              <a href="#inquiry" className={styles.primaryBtn}>상담 문의하기</a>
              <a href={`tel:${SITE.phone}`} className={styles.ghostBtn}>전화 {SITE.phone}</a>
            </div>
          </div>
        </section>

        <section id="overview" className={styles.section}>
          <div className={styles.inner}>
            <h2 className={styles.sectionTitle}>단지 개요</h2>
            <dl className={styles.stats}>
              {OVERVIEW.map((o) => (
                <div key={o.label} className={styles.stat}>
                  <dt>{o.label}</dt>
                  <dd>{o.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="types" className={`${styles.section} ${styles.alt}`}>
          <div className={styles.inner}>
            <h2 className={styles.sectionTitle}>타입 안내</h2>
            <p className={styles.sectionLead}>전용면적 기준이며, 타입별 세대수는 공급 기준입니다.</p>
            <ul className={styles.types}>
              {UNIT_TYPES.map((t) => (
                <li key={t.type} className={styles.typeCard}>
                  <p className={styles.typeName}>{t.type}</p>
                  <p className={styles.typeArea}>전용 {t.area}㎡</p>
                  <p className={styles.typeNote}>{t.note}</p>
                  <p className={styles.typeCount}>{t.count}세대</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="inquiry" className={styles.section}>
          <div className={`${styles.inner} ${styles.inquiry}`}>
            <div className={styles.inquiryIntro}>
              <h2 className={styles.sectionTitle}>상담 문의</h2>
              <p className={styles.sectionLead}>
                남겨 주신 연락처로 분양 담당자가 연락드립니다.
                방문 상담 예약, 타입별 분양가, 대출 조건 등 무엇이든 물어보세요.
              </p>
              <ul className={styles.contact}>
                <li><span>대표 전화</span><a href={`tel:${SITE.phone}`}>{SITE.phone}</a></li>
                <li><span>상담 시간</span>{SITE.hours}</li>
              </ul>
            </div>
            <div className={styles.formCard}>
              <InquiryForm />
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.inner}>
          <p>{SITE.name}({SITE.nameNote}) 분양 홍보 페이지</p>
          <p className={styles.muted}>
            본 페이지의 이미지·수치·내용은 소비자의 이해를 돕기 위한 것으로 실제와 다를 수 있으며,
            분양 조건은 입주자 모집공고를 기준으로 합니다.
          </p>
        </div>
      </footer>
    </>
  );
}

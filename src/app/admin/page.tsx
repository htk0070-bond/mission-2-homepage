import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDashboard, PERIODS, type Period } from "@/lib/admin-data";
import { Donut, Empty, HBars, MonthlyCombo, RemainingGrid, StackedBar } from "./charts";
import { logout } from "./actions";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "관리자 대시보드",
  robots: { index: false, follow: false },
};

const fmt = (n: number) => n.toLocaleString("ko-KR");
const eok = (thousand: number) => `${(thousand / 100000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
const man = (thousand: number) => `${fmt(Math.round(thousand / 10))}만원`;

// 화면 틀은 바로 보여 주고, 요청 시점 데이터(세션 확인·Supabase 조회)는 Suspense 안에서 스트리밍한다.
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className={styles.dash}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>관리자 대시보드</h1>
          <p className={styles.mutedSmall}>요청할 때마다 Supabase에서 최신 데이터를 읽습니다</p>
        </div>
        <form action={logout}>
          <button type="submit" className={styles.ghostBtn}>로그아웃</button>
        </form>
      </header>
      <Suspense fallback={<p className={styles.loading} role="status">데이터를 불러오는 중…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const sp = await searchParams;
  const period = (PERIODS.some((p) => p.key === sp.period) ? sp.period : "month") as Period;
  const d = await getDashboard(period);
  const { kpi } = d;
  const maxCost = Math.max(0, ...d.ads.map((a) => a.cost));
  const maxLeads = Math.max(0, ...d.ads.map((a) => a.leads));

  return (
    <>
      <nav className={styles.filters} aria-label="기간 필터">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/admin?period=${p.key}`} className={styles.filter}
            aria-current={p.key === period ? "page" : undefined}>
            {p.key === period && <span aria-hidden="true">✓ </span>}{p.label}
          </Link>
        ))}
        <span className={styles.rangeCaption}>{d.range.caption}</span>
      </nav>

      <section className={styles.kpis} aria-label="요약">
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>총 고객</p>
          <p className={styles.kpiValue}>{fmt(kpi.customers)}<small>명</small></p>
          <p className={styles.mutedSmall}>{period === "all" ? "등록된 전체 고객" : `${d.range.label} 가입 기준`}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>{d.range.label} 문의</p>
          <p className={styles.kpiValue}>{fmt(kpi.inquiries)}<small>건</small></p>
          <p className={styles.mutedSmall}>홈페이지 문의 폼 접수</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>계약 건수 / 금액</p>
          <p className={styles.kpiValue}>{fmt(kpi.contracts)}<small>건</small></p>
          <p className={styles.mutedSmall}>{eok(kpi.contractAmount)} · 해지 {fmt(kpi.cancelled)}건은 제외</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kpiLabel}>계약 전환율</p>
          {kpi.conversion ? (
            <>
              <p className={styles.kpiValue}>{(kpi.conversion.rate * 100).toFixed(1)}<small>%</small></p>
              <p className={styles.mutedSmall}>계약 고객 {fmt(kpi.conversion.contracted)}명 ÷ 상담 고객 {fmt(kpi.conversion.consulted)}명</p>
            </>
          ) : (
            <>
              <p className={styles.kpiValue}>–</p>
              <p className={styles.mutedSmall}>데이터 없음 (기간 내 상담 없음)</p>
            </>
          )}
        </div>
      </section>

      <h2 className={styles.groupTitle}>고객</h2>
      <div className={styles.row}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>등급별 고객</h3>
          <Donut data={d.grades} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>유입경로별 고객</h3>
          <HBars data={d.leadSources} unit="명" />
        </section>
      </div>

      <h2 className={styles.groupTitle}>계약 <span className={styles.mutedSmall}>해지 제외</span></h2>
      <div className={styles.row}>
        <section className={`${styles.card} ${styles.wide}`}>
          <h3 className={styles.cardTitle}>월별 계약 건수·금액</h3>
          <MonthlyCombo data={d.monthly} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>타입별 계약 비중</h3>
          <HBars data={d.contractTypes} unit="건" showPct />
        </section>
      </div>

      <h2 className={styles.groupTitle}>분양 <span className={styles.mutedSmall}>현재 세대 상태 기준 · 기간 필터 미적용</span></h2>
      <div className={styles.row}>
        <section className={`${styles.card} ${styles.wide}`}>
          <h3 className={styles.cardTitle}>동·타입별 잔여 세대 <span className={styles.mutedSmall}>계약완료 외 {fmt(d.remaining.total)}세대</span></h3>
          <RemainingGrid buildings={d.remaining.buildings} types={d.remaining.types} cells={d.remaining.cells} />
        </section>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>계약 / 미계약 비율</h3>
          <StackedBar data={d.unitStatus} unit="세대" />
        </section>
      </div>

      <h2 className={styles.groupTitle}>광고</h2>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>채널별 집행비 · 리드 · 계약 1건당 비용</h3>
        {d.ads.length ? (
          <div className={styles.gridScroll}>
            <table className={styles.adTable}>
              <thead>
                <tr><th scope="col">채널</th><th scope="col">집행비</th><th scope="col">리드</th><th scope="col">계약</th><th scope="col">계약 1건당 비용</th></tr>
              </thead>
              <tbody>
                {d.ads.map((a) => (
                  <tr key={a.channel}>
                    <th scope="row">{a.channel}</th>
                    <td>
                      <span className={styles.cellBar}><span style={{ width: `${(a.cost / maxCost) * 100}%` }} /></span>
                      {man(a.cost)}
                    </td>
                    <td>
                      <span className={styles.cellBar}><span style={{ width: `${(a.leads / maxLeads) * 100}%`, background: "var(--s3)" }} /></span>
                      {fmt(a.leads)}건
                    </td>
                    <td>{a.contracts === null ? <span className={styles.mutedSmall}>연결 안 함</span> : `${fmt(a.contracts)}건`}</td>
                    <td>{a.costPerContract === null ? <span className={styles.mutedSmall}>{a.contracts === null ? "–" : "계약 없음"}</span> : man(a.costPerContract)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>
              계약은 확정 대응표로 연결된 채널만 집계합니다 (블로그→블로그, SNS광고→SNS, 포털검색광고→광고(네이버), 지인추천이벤트→지인소개).
              계약 고객의 유입경로 기준이며, 광고 데이터가 있는 달({d.adPeriod})의 계약만 셉니다.
            </p>
          </div>
        ) : (
          <Empty note="광고 데이터는 2024년 1월 ~ 2025년 12월까지만 있습니다. 전체 기간에서 확인하세요." />
        )}
      </section>
    </>
  );
}

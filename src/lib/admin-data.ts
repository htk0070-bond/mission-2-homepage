import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { verifyAdmin } from "./admin-dal";
import { UNIT_TYPES } from "./site";
import { computeInsights, type Insight } from "./admin-insights";

// 관리자 대시보드 집계. 요청마다 Supabase에서 새로 읽는다 (캐시 없음).
// 금액은 DB와 같이 천원 단위로 계산하고 화면에서 억원·만원으로 바꾼다.

export type Period = "month" | "quarter" | "all";
export const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "이번 달" },
  { key: "quarter", label: "이번 분기" },
  { key: "all", label: "전체" },
];

// 광고 채널 ↔ 고객 유입경로 확정 대응표 (2026-10-24). 나머지 채널은 연결하지 않는다.
export const AD_TO_LEAD: Record<string, string> = {
  블로그: "블로그",
  SNS광고: "SNS",
  포털검색광고: "광고(네이버)",
  지인추천이벤트: "지인소개",
};

export const GRADE_ORDER = ["vvip", "vip", "일반", "관심고객", "신규"];
export const UNIT_STATUS_ORDER = ["계약완료", "예약", "보류", "미계약"];

type Range = { start: string | null; end: string | null; label: string; caption: string };

const pad = (n: number) => String(n).padStart(2, "0");

// 서버 시간대와 무관하게 한국 날짜 기준
function todayKst() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function todayString() {
  const { y, m, d } = todayKst();
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function periodRange(period: Period): Range {
  const { y, m, d } = todayKst();
  const today = todayString();
  if (period === "month") {
    return { start: `${y}-${pad(m)}-01`, end: today, label: "이번 달", caption: `${y}년 ${m}월 1일 ~ 오늘(${m}/${d})` };
  }
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3);
    const sm = q * 3 + 1;
    return { start: `${y}-${pad(sm)}-01`, end: today, label: "이번 분기", caption: `${y}년 ${q + 1}분기 (${sm}월 1일 ~ 오늘)` };
  }
  return { start: null, end: null, label: "전체", caption: "전체 기간" };
}

const inRange = (date: string | null, r: Range) =>
  !!date && (!r.start || date >= r.start) && (!r.end || date <= r.end);

// PostgREST는 한 번에 최대 1,000행이라 나눠서 모두 읽는다
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const db = supabaseAdmin();
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(columns).range(from, from + size - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return rows;
}

export type Customer = { customer_id: string; grade: string | null; lead_source: string | null; signup_date: string | null; interest_type: string | null };
export type Consultation = { customer_id: string; consult_date: string; outcome: string | null; consultant: string | null };
export type Contract = { customer_id: string; unit_id: string; contract_date: string; price_thousand_krw: number | null; status: string | null };
export type Unit = { unit_id: string; building: string; unit_type: string | null; status: string | null; price_thousand_krw: number | null };
export type Ad = { spend_month: string; channel: string; cost_thousand_krw: number | null; leads: number | null };
type Inquiry = { created_at: string };

export type Slice = { label: string; value: number };

export type Dashboard = {
  range: Range;
  kpi: {
    customers: number;
    inquiries: number;
    contracts: number;
    contractAmount: number; // 천원
    cancelled: number;
    conversion: { rate: number; contracted: number; consulted: number } | null;
  };
  grades: Slice[];
  leadSources: Slice[];
  monthly: { month: string; count: number; amount: number }[];
  contractTypes: Slice[];
  unitStatus: Slice[];
  remaining: { buildings: string[]; types: string[]; cells: Record<string, number>; total: number };
  ads: { channel: string; cost: number; leads: number; contracts: number | null; costPerContract: number | null }[];
  adPeriod: string | null; // 광고 데이터가 있는 기간 (예: 2024-01 ~ 2025-12)
  insights: Insight[]; // 전체 데이터 기준 (기간 필터 미적용)
};

const countBy = <T,>(rows: T[], key: (r: T) => string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
  return m;
};

// 이벤트 날짜를 KST 날짜(YYYY-MM-DD)로
const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));

export async function getDashboard(period: Period): Promise<Dashboard> {
  await verifyAdmin();
  const range = periodRange(period);

  const [customers, consultations, contracts, units, ads, inquiries] = await Promise.all([
    fetchAll<Customer>("customers", "customer_id, grade, lead_source, signup_date, interest_type"),
    fetchAll<Consultation>("consultations", "customer_id, consult_date, outcome, consultant"),
    fetchAll<Contract>("contracts", "customer_id, unit_id, contract_date, price_thousand_krw, status"),
    fetchAll<Unit>("units", "unit_id, building, unit_type, status, price_thousand_krw"),
    fetchAll<Ad>("ad_spend", "spend_month, channel, cost_thousand_krw, leads"),
    fetchAll<Inquiry>("inquiries", "created_at"),
  ]);

  // 전체 기간은 날짜 필터 없이 모든 행 (미래 날짜로 들어온 행 포함)
  const pick = <T,>(rows: T[], date: (r: T) => string | null) =>
    period === "all" ? rows : rows.filter((r) => inRange(date(r), range));

  const custP = pick(customers, (c) => c.signup_date);
  const consP = pick(consultations, (c) => c.consult_date);
  const contAll = pick(contracts, (c) => c.contract_date);
  const contP = contAll.filter((c) => c.status !== "해지");
  const adsP = pick(ads, (a) => a.spend_month); // 집행 월은 매월 1일로 저장돼 있음
  const inqP = pick(inquiries, (i) => kstDate(i.created_at));

  // 계약 전환율 = 기간 내 계약(해지 제외) 고객 수 ÷ 기간 내 상담 고객 수.
  // 상담과 계약이 다른 달에 일어나는 경우가 많아 같은 고객의 교집합이 아닌 비율로 본다.
  const consulted = new Set(consP.map((c) => c.customer_id));
  const contracted = new Set(contP.map((c) => c.customer_id));

  const gradeMap = countBy(custP, (c) => c.grade ?? "미분류");
  const grades = [...GRADE_ORDER, "미분류"].map((g) => ({ label: g, value: gradeMap.get(g) ?? 0 })).filter((s) => s.value > 0);

  const leadMap = countBy(custP, (c) => c.lead_source ?? "미분류");
  const leadSources = [...leadMap].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // 월별 계약: 기간 안의 모든 달을 0 포함해 나열
  const byMonth = new Map<string, { count: number; amount: number }>();
  contP.forEach((c) => {
    const k = c.contract_date.slice(0, 7);
    const v = byMonth.get(k) ?? { count: 0, amount: 0 };
    v.count += 1;
    v.amount += c.price_thousand_krw ?? 0;
    byMonth.set(k, v);
  });
  const months: string[] = [];
  const keys = [...byMonth.keys()].sort();
  const first = range.start?.slice(0, 7) ?? keys[0];
  const last = range.end?.slice(0, 7) ?? keys[keys.length - 1];
  if (first && last && contP.length) {
    let [yy, mm] = first.split("-").map(Number);
    for (;;) {
      const k = `${yy}-${pad(mm)}`;
      months.push(k);
      if (k >= last) break;
      mm += 1;
      if (mm > 12) { mm = 1; yy += 1; }
    }
  }
  const monthly = months.map((month) => ({ month, ...(byMonth.get(month) ?? { count: 0, amount: 0 }) }));

  const unitById = new Map(units.map((u) => [u.unit_id, u]));
  const typeMap = countBy(contP, (c) => unitById.get(c.unit_id)?.unit_type ?? "미상");
  const typeOrder = UNIT_TYPES.map((t) => t.type);
  const contractTypes = [...typeMap]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || typeOrder.indexOf(a.label) - typeOrder.indexOf(b.label));

  // 분양 현황은 기간과 무관한 현재 상태 (units.status)
  const statusMap = countBy(units, (u) => u.status ?? "미상");
  const unitStatus = UNIT_STATUS_ORDER.map((s) => ({ label: s, value: statusMap.get(s) ?? 0 }));

  const left = units.filter((u) => u.status !== "계약완료");
  const cells: Record<string, number> = {};
  left.forEach((u) => {
    const k = `${u.building}|${u.unit_type ?? "미상"}`;
    cells[k] = (cells[k] ?? 0) + 1;
  });
  const buildings = [...new Set(units.map((u) => u.building))].sort();
  const types = typeOrder.filter((t) => units.some((u) => u.unit_type === t));

  // 광고: 채널별 집행비·리드, 대응표로 연결된 채널만 계약 수와 계약 1건당 비용
  const adMap = new Map<string, { cost: number; leads: number }>();
  adsP.forEach((a) => {
    const v = adMap.get(a.channel) ?? { cost: 0, leads: 0 };
    v.cost += a.cost_thousand_krw ?? 0;
    v.leads += a.leads ?? 0;
    adMap.set(a.channel, v);
  });
  // 계약 1건당 비용은 광고 데이터가 있는 달의 계약만 센다 (기간이 어긋나 비용이 낮게 보이지 않도록)
  const adMonths = new Set(adsP.map((a) => a.spend_month.slice(0, 7)));
  const leadOf = new Map(customers.map((c) => [c.customer_id, c.lead_source]));
  const adsOut = [...adMap]
    .map(([channel, v]) => {
      const lead = AD_TO_LEAD[channel];
      const n = lead
        ? contP.filter((c) => adMonths.has(c.contract_date.slice(0, 7)) && leadOf.get(c.customer_id) === lead).length
        : null;
      return { channel, cost: v.cost, leads: v.leads, contracts: n, costPerContract: n ? v.cost / n : null };
    })
    .sort((a, b) => b.cost - a.cost);

  return {
    range,
    kpi: {
      customers: custP.length,
      inquiries: inqP.length,
      contracts: contP.length,
      contractAmount: contP.reduce((s, c) => s + (c.price_thousand_krw ?? 0), 0),
      cancelled: contAll.length - contP.length,
      conversion: consulted.size
        ? { rate: contracted.size / consulted.size, contracted: contracted.size, consulted: consulted.size }
        : null,
    },
    grades,
    leadSources,
    monthly,
    contractTypes,
    unitStatus,
    remaining: { buildings, types, cells, total: left.length },
    ads: adsOut,
    adPeriod: adMonths.size ? `${[...adMonths].sort()[0]} ~ ${[...adMonths].sort().at(-1)}` : null,
    insights: computeInsights({ customers, consultations, contracts, units, ads, today: todayString() }),
  };
}

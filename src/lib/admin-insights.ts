import "server-only";
import { AD_TO_LEAD, type Ad, type Consultation, type Contract, type Customer, type Unit } from "./admin-data";

// 인사이트 4개를 매 요청마다 전체 데이터로 계산한다 (기간 필터와 무관).
// 문장은 템플릿이고 숫자·채널·타입 이름은 데이터에서 고른다. 조건이 사라지면 "해소" 문구로 바뀐다.

export type InsightStat = { label: string; value: string };
export type Insight = {
  id: string;
  title: string;
  status: "action" | "ok";
  finding: string;
  evidence: InsightStat[];
  evidenceNote: string;
  actions: string[];
};

const fmt = (n: number) => n.toLocaleString("ko-KR");
const man = (thousand: number) => `${fmt(Math.round(thousand / 10))}만원`;
const eok = (thousand: number) => `${(thousand / 100000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
const man1 = (thousand: number) => `${(thousand / 10).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}만원`;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");

// 이름 끝 글자 받침에 맞는 조사 (블로그가 / 지인추천이벤트가 / 포털검색광고가). 한글이 아니면 받침 없음으로 본다.
function josa(word: string, withFinal: string, withoutFinal: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

function daysBefore(date: string, days: number) {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - days);
  return t.toISOString().slice(0, 10);
}

type Input = { customers: Customer[]; consultations: Consultation[]; contracts: Contract[]; units: Unit[]; ads: Ad[]; today: string };

export function computeInsights({ customers, consultations, contracts, units, ads, today }: Input): Insight[] {
  const live = contracts.filter((c) => c.status !== "해지");
  const contracted = new Set(live.map((c) => c.customer_id));
  return [adBudget(customers, live, ads), hopeFollowUp(consultations, contracted, today), typeInventory(customers, units), unitStatusSync(units, contracts)];
}

// ① 광고 예산: 연결된 채널의 계약 1건당 비용 비교 (광고 데이터가 있는 달의 계약만)
function adBudget(customers: Customer[], live: Contract[], ads: Ad[]): Insight {
  const months = new Set(ads.map((a) => a.spend_month.slice(0, 7)));
  const sorted = [...months].sort();
  const leadOf = new Map(customers.map((c) => [c.customer_id, c.lead_source]));
  const rows = Object.entries(AD_TO_LEAD).map(([channel, lead]) => {
    const rs = ads.filter((a) => a.channel === channel);
    const cost = rs.reduce((s, a) => s + (a.cost_thousand_krw ?? 0), 0);
    const leads = rs.reduce((s, a) => s + (a.leads ?? 0), 0);
    const n = live.filter((c) => months.has(c.contract_date.slice(0, 7)) && leadOf.get(c.customer_id) === lead).length;
    return { channel, cost, leads, n, cpc: n ? cost / n : null, cpl: leads ? cost / leads : null };
  }).filter((r) => r.cost > 0 && r.cpc !== null) as { channel: string; cost: number; leads: number; n: number; cpc: number; cpl: number | null }[];

  const base = { id: "ad-budget", title: "광고 예산 재배분" };
  if (rows.length < 2) {
    return { ...base, status: "ok", finding: "계약과 연결된 광고 채널이 2개 미만이라 비교할 수 없습니다.", evidence: [], evidenceNote: "광고 집행 표 + 계약 고객 유입경로", actions: ["광고 채널과 유입경로 대응표를 확인하세요."] };
  }
  rows.sort((a, b) => a.cpc - b.cpc);
  const best = rows[0], worst = rows[rows.length - 1];
  const ratio = worst.cpc / best.cpc;
  const cpls = rows.map((r) => r.cpl ?? 0);
  return {
    ...base,
    status: ratio >= 1.5 ? "action" : "ok",
    finding: `리드 1건당 비용은 ${man1(Math.min(...cpls))}~${man1(Math.max(...cpls))}으로 비슷하지만, 계약 1건당 비용은 ${josa(best.channel, "이", "가")} ${worst.channel}보다 ${ratio.toFixed(1)}배 낮습니다.`,
    evidence: rows.map((r) => ({ label: r.channel, value: `계약 1건당 ${man(r.cpc)} · 집행 ${eok(r.cost)} · 계약 ${fmt(r.n)}건` })),
    evidenceNote: `광고 집행 표 + 계약(해지 제외) 고객의 유입경로, ${sorted[0]} ~ ${sorted.at(-1)} 기준`,
    actions: [
      `${worst.channel} 예산의 일부를 ${josa(best.channel, "으로", "로")} 옮기고 한 분기 동안 계약 1건당 비용 변화를 측정합니다.`,
      "계약과 연결되지 않는 채널(옥외광고·전시관행사)은 상담 시 유입경로 기록 항목부터 정합니다.",
    ],
  };
}

// ② 최근 90일 안에 "계약희망"이었는데 아직 계약이 없는 고객
function hopeFollowUp(consultations: Consultation[], contracted: Set<string>, today: string): Insight {
  const since = daysBefore(today, 90);
  const byCustomer = new Map<string, { hope: boolean; last: Consultation }>();
  consultations.forEach((c) => {
    const v = byCustomer.get(c.customer_id);
    const hope = (v?.hope ?? false) || c.outcome === "계약희망";
    const last = !v || c.consult_date > v.last.consult_date ? c : v.last;
    byCustomer.set(c.customer_id, { hope, last });
  });
  const all = [...byCustomer.entries()];
  const hopeAll = all.filter(([, v]) => v.hope);
  const noHope = all.filter(([, v]) => !v.hope);
  const hopeConv = hopeAll.filter(([id]) => contracted.has(id)).length;
  const noHopeConv = noHope.filter(([id]) => contracted.has(id)).length;
  const pending = hopeAll.filter(([id, v]) => !contracted.has(id) && v.last.consult_date >= since && v.last.consult_date <= today);

  const byRep = new Map<string, number>();
  pending.forEach(([, v]) => byRep.set(v.last.consultant ?? "미지정", (byRep.get(v.last.consultant ?? "미지정") ?? 0) + 1));
  const reps = [...byRep].sort((a, b) => b[1] - a[1]);
  const hopeRate = hopeAll.length ? hopeConv / hopeAll.length : 0;
  const noHopeRate = noHope.length ? noHopeConv / noHope.length : 0;

  return {
    id: "hope-follow-up",
    title: "계약희망 고객 후속 연락",
    status: pending.length ? "action" : "ok",
    finding: pending.length
      ? `최근 90일 안에 상담 결과가 "계약희망"이었지만 아직 계약하지 않은 고객이 ${fmt(pending.length)}명 있습니다.`
      : `최근 90일 안의 "계약희망" 고객은 모두 계약으로 이어졌습니다.`,
    evidence: [
      { label: "후속 대상 (최근 90일 · 미계약)", value: `${fmt(pending.length)}명` },
      { label: "\"계약희망\" 이력 고객의 계약률", value: `${pct(hopeConv, hopeAll.length)} (${fmt(hopeConv)}/${fmt(hopeAll.length)}명)` },
      { label: "\"계약희망\" 이력 없는 고객의 계약률", value: `${pct(noHopeConv, noHope.length)} (${fmt(noHopeConv)}/${fmt(noHope.length)}명)` },
      ...(reps.length ? [{ label: "마지막 상담 담당자별", value: reps.slice(0, 4).map(([r, n]) => `${r} ${n}`).join(" · ") + (reps.length > 4 ? ` 외 ${reps.length - 4}명` : "") }] : []),
    ],
    evidenceNote: `상담 이력 + 계약(해지 제외), ${since} ~ ${today} 마지막 상담 기준`,
    actions: [
      ...(pending.length ? [`후속 대상 ${fmt(pending.length)}명을 마지막 상담 담당자에게 배정해 2주 안에 다시 연락합니다.`] : []),
      hopeRate <= noHopeRate
        ? "\"계약희망\" 결과가 실제 계약을 예측하지 못하고 있습니다. 상담 결과 기준(예: 방문 예약·계약금 안내 여부)을 다시 정합니다."
        : "\"계약희망\" 결과가 계약을 잘 예측하고 있으니, 이 고객군을 우선 관리 대상으로 유지합니다.",
    ],
  };
}

// ③ 타입별 관심 대비 판매율과 잔여 재고
function typeInventory(customers: Customer[], units: Unit[]): Insight {
  const types = [...new Set(units.map((u) => u.unit_type).filter(Boolean))] as string[];
  const rows = types.map((t) => {
    const us = units.filter((u) => u.unit_type === t);
    const sold = us.filter((u) => u.status === "계약완료").length;
    const interested = customers.filter((c) => c.interest_type === t).length;
    const prices = us.map((u) => u.price_thousand_krw ?? 0).filter((p) => p > 0);
    return { t, total: us.length, sold, left: us.length - sold, interested, rate: us.length ? sold / us.length : 0, price: prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0 };
  });
  const base = { id: "type-inventory", title: "타입별 재고 집중 판매" };
  if (!rows.length) return { ...base, status: "ok", finding: "세대 데이터가 없습니다.", evidence: [], evidenceNote: "세대 표", actions: [] };

  const avgRate = rows.reduce((s, r) => s + r.sold, 0) / rows.reduce((s, r) => s + r.total, 0);
  const slow = [...rows].sort((a, b) => a.rate - b.rate || b.interested - a.interested)[0];
  const most = [...rows].sort((a, b) => b.left - a.left)[0];
  const best = [...rows].sort((a, b) => b.rate - a.rate)[0];
  const picks = [...new Map([slow, most, best].map((r) => [r.t, r])).values()];

  return {
    ...base,
    status: slow.rate < avgRate * 0.75 || most.left > 0 ? "action" : "ok",
    finding: `${slow.t}는 관심 고객이 ${fmt(slow.interested)}명인데 판매율이 ${pct(slow.sold, slow.total)}로 가장 낮고, ${most.t}는 잔여 ${fmt(most.left)}세대로 재고가 가장 많습니다.`,
    evidence: picks.map((r) => ({
      label: `${r.t}${r.t === best.t ? " (판매율 최고, 비교)" : ""}`,
      value: `판매 ${r.sold}/${r.total}세대 (${pct(r.sold, r.total)}) · 잔여 ${r.left} · 관심 ${fmt(r.interested)}명 · 평균 ${eok(r.price)}`,
    })).concat([{ label: "전체 평균 판매율", value: pct(avgRate, 1) }]),
    evidenceNote: "세대 표(현재 상태) + 고객 관심타입",
    actions: [
      `${slow.t} 관심 고객 ${fmt(slow.interested)}명에게 타입 안내와 견본 방문 초대를 보내고, 판매가 늦은 이유를 상담 메모로 확인합니다.`,
      `${most.t} 잔여 ${fmt(most.left)}세대는 예산이 맞는 고객군을 대상으로 한정 조건(옵션·납부 일정)을 검토합니다.`,
    ],
  };
}

// ④ 세대 표 상태와 계약 표의 불일치
function unitStatusSync(units: Unit[], contracts: Contract[]): Insight {
  const byUnit = new Map<string, Contract[]>();
  contracts.forEach((c) => byUnit.set(c.unit_id, [...(byUnit.get(c.unit_id) ?? []), c]));
  const unsoldWithContract = units.filter((u) => u.status === "미계약" && (byUnit.get(u.unit_id)?.length ?? 0) > 0);
  const unsoldWithDone = unsoldWithContract.filter((u) => byUnit.get(u.unit_id)!.some((c) => c.status === "완료"));
  const doneContracts = unsoldWithContract.reduce((s, u) => s + byUnit.get(u.unit_id)!.filter((c) => c.status === "완료").length, 0);
  const unsold = units.filter((u) => u.status === "미계약").length;
  const soldByUnits = units.filter((u) => u.status === "계약완료").length;
  const withLive = units.filter((u) => byUnit.get(u.unit_id)?.some((c) => c.status !== "해지")).length;
  const mismatch = unsoldWithContract.length > 0;

  return {
    id: "unit-status-sync",
    title: "세대 상태와 계약 기록 정합성",
    status: mismatch ? "action" : "ok",
    finding: mismatch
      ? `세대 표에서 "미계약"인 ${fmt(unsold)}세대 중 ${fmt(unsoldWithContract.length)}세대에 계약 기록이 있어, 표마다 계약률이 다르게 나옵니다.`
      : `세대 표의 "미계약" 세대에는 계약 기록이 없습니다. 두 표가 일치합니다.`,
    evidence: [
      { label: "\"미계약\"인데 계약 기록 있음", value: `${fmt(unsoldWithContract.length)}/${fmt(unsold)}세대` },
      { label: "그중 계약 상태 \"완료\"", value: `${fmt(unsoldWithDone.length)}세대 · 계약 ${fmt(doneContracts)}건` },
      { label: "계약률 · 세대 표 기준", value: `${pct(soldByUnits, units.length)} (계약완료 ${fmt(soldByUnits)}/${fmt(units.length)})` },
      { label: "계약률 · 계약 표 기준", value: `${pct(withLive, units.length)} (해지 외 계약 있는 세대 ${fmt(withLive)}/${fmt(units.length)})` },
    ],
    evidenceNote: "세대 표 status vs 계약 표",
    actions: mismatch
      ? [
          "시행사 보고의 계약률을 어느 표 기준으로 쓸지 정하고 보고서에 기준을 적습니다.",
          "계약 등록·해지 시 세대 상태가 함께 바뀌도록 업무 절차 또는 DB 트리거를 만듭니다.",
        ]
      : ["현재 절차를 유지하고 월간 점검에서 계속 확인합니다."],
  };
}

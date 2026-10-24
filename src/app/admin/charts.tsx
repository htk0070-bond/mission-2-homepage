import type { Slice } from "@/lib/admin-data";
import styles from "./admin.module.css";

// 차트는 라이브러리 없이 SVG로 그린다. 색은 admin.module.css의 --s1~--s5 (검증한 범주 팔레트).
// 마우스를 올리면 <title>로 값이 보이고, 같은 값은 범례·라벨·표에도 있어 툴팁에만 의존하지 않는다.

const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];
const fmt = (n: number) => n.toLocaleString("ko-KR");
const pct = (n: number, total: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : "0%");

export function Empty({ note }: { note?: string }) {
  return (
    <div className={styles.empty} role="status">
      <p>데이터 없음</p>
      {note && <p className={styles.mutedSmall}>{note}</p>}
    </div>
  );
}

/** 도넛 + 값·비율 범례 (범주 5개 이하) */
export function Donut({ data, unit = "명" }: { data: Slice[]; unit?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const R = 70, r = 46, C = 90;
  const gap = data.length > 1 ? 0.025 : 0; // 조각 사이 표면 틈
  const starts = data.map((_, i) =>
    -Math.PI / 2 + (data.slice(0, i).reduce((s, x) => s + x.value, 0) / total) * Math.PI * 2);
  const arcs = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const a0 = starts[i] + gap / 2, a1 = starts[i] + sweep - gap / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, rr: number) => `${C + rr * Math.cos(rad)} ${C + rr * Math.sin(rad)}`;
    const path = sweep >= Math.PI * 2 - 0.001
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
      : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    return { ...d, path, color: SERIES[i % SERIES.length] };
  });
  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 180 180" className={styles.donut} role="img" aria-label="등급별 고객 비율">
        {arcs.map((a) => (
          <path key={a.label} d={a.path} fill={a.color} className={styles.mark}>
            <title>{`${a.label}: ${fmt(a.value)}${unit} (${pct(a.value, total)})`}</title>
          </path>
        ))}
        <text x="90" y="86" textAnchor="middle" className={styles.donutTotal}>{fmt(total)}</text>
        <text x="90" y="106" textAnchor="middle" className={styles.donutCaption}>{`전체 ${unit === "명" ? "고객" : ""}`}</text>
      </svg>
      <ul className={styles.legend}>
        {arcs.map((a) => (
          <li key={a.label}>
            <span className={styles.swatch} style={{ background: a.color }} aria-hidden="true" />
            <span className={styles.legendLabel}>{a.label}</span>
            <span className={styles.legendValue}>{fmt(a.value)}{unit}</span>
            <span className={styles.legendPct}>{pct(a.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 가로 막대 (단일 계열, 값·비율을 막대 끝에) */
export function HBars({ data, unit, showPct = false }: { data: Slice[]; unit: string; showPct?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <ul className={styles.hbars}>
      {data.map((d) => (
        <li key={d.label} className={styles.hbarRow} title={`${d.label}: ${fmt(d.value)}${unit} (${pct(d.value, total)})`}>
          <span className={styles.hbarLabel}>{d.label}</span>
          <span className={styles.hbarTrack}>
            <span className={styles.hbarFill} style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className={styles.hbarValue}>
            {fmt(d.value)}{unit}{showPct && <span className={styles.legendPct}> {pct(d.value, total)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const nice = (max: number) => {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
};

/** 월별 계약 건수(막대·왼쪽 축)와 금액(선·오른쪽 축, 억원) */
export function MonthlyCombo({ data }: { data: { month: string; count: number; amount: number }[] }) {
  if (!data.length || !data.some((d) => d.count)) return <Empty />;
  const W = 640, H = 270, L = 40, Rm = 52, T = 28, B = 34;
  const iw = W - L - Rm, ih = H - T - B;
  const eok = data.map((d) => d.amount / 100000); // 천원 → 억원
  const cMax = nice(Math.max(...data.map((d) => d.count)));
  const aMax = nice(Math.max(...eok));
  const step = iw / data.length;
  const bw = Math.min(24, step * 0.6);
  const x = (i: number) => L + step * i + step / 2;
  const ya = (v: number) => T + ih - (v / aMax) * ih;
  const every = Math.ceil(data.length / 12);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const line = eok.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${ya(v)}`).join(" ");
  const label = (m: string, i: number) => (i === 0 || m.endsWith("-01") ? `${m.slice(2, 4)}.${m.slice(5)}` : m.slice(5));

  return (
    <div>
      <ul className={styles.legendRow}>
        <li><span className={styles.swatch} style={{ background: "var(--s1)" }} aria-hidden="true" />계약 건수 (왼쪽 축, 건)</li>
        <li><span className={styles.lineKey} style={{ background: "var(--s2)" }} aria-hidden="true" />계약 금액 (오른쪽 축, 억원)</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} role="img" aria-label="월별 계약 건수와 금액">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - Rm} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} className={t ? styles.grid : styles.axis} />
            <text x={L - 6} y={T + ih * (1 - t) + 4} textAnchor="end" className={styles.tick}>{fmt(cMax * t)}</text>
            <text x={W - Rm + 6} y={T + ih * (1 - t) + 4} className={styles.tick}>{fmt(Math.round(aMax * t * 10) / 10)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.count / cMax) * ih;
          const y0 = T + ih;
          const rr = Math.min(4, h / 2, bw / 2);
          const xl = x(i) - bw / 2;
          const path = h > 0
            ? `M ${xl} ${y0} V ${y0 - h + rr} Q ${xl} ${y0 - h} ${xl + rr} ${y0 - h} H ${xl + bw - rr} Q ${xl + bw} ${y0 - h} ${xl + bw} ${y0 - h + rr} V ${y0} Z`
            : "";
          return (
            <g key={d.month}>
              <rect x={x(i) - step / 2} y={T} width={step} height={ih} fill="transparent">
                <title>{`${d.month} · ${fmt(d.count)}건 · ${eok[i].toFixed(1)}억원`}</title>
              </rect>
              {path && <path d={path} fill="var(--s1)" className={styles.mark} pointerEvents="none" />}
              {i % every === 0 && (
                <text x={x(i)} y={H - B + 18} textAnchor="middle" className={styles.tick}>{label(d.month, i)}</text>
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--s2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        {data.length <= 16 && eok.map((v, i) => (
          <circle key={i} cx={x(i)} cy={ya(v)} r={4} fill="var(--s2)" stroke="var(--card)" strokeWidth={2} pointerEvents="none" />
        ))}
        <text x={L - 6} y={12} textAnchor="end" className={styles.axisTitle}>(건)</text>
        <text x={W - Rm + 6} y={12} className={styles.axisTitle}>(억원)</text>
      </svg>
      <details className={styles.tableView}>
        <summary>표로 보기</summary>
        <table>
          <thead><tr><th>월</th><th>건수</th><th>금액(억원)</th></tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.month}><td>{d.month}</td><td>{fmt(d.count)}</td><td>{eok[i].toFixed(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** 100% 누적 가로 막대 + 값 범례 */
export function StackedBar({ data, unit }: { data: Slice[]; unit: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const shown = data.filter((d) => d.value > 0);
  return (
    <div>
      <div className={styles.stack} role="img" aria-label={shown.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}>
        {shown.map((d) => (
          <span key={d.label} className={styles.stackSeg} title={`${d.label}: ${fmt(d.value)}${unit} (${pct(d.value, total)})`}
            style={{ flexGrow: d.value, background: SERIES[data.indexOf(d) % SERIES.length] }} />
        ))}
      </div>
      <ul className={styles.legend}>
        {data.map((d, i) => (
          <li key={d.label}>
            <span className={styles.swatch} style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span className={styles.legendLabel}>{d.label}</span>
            <span className={styles.legendValue}>{fmt(d.value)}{unit}</span>
            <span className={styles.legendPct}>{pct(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 동 × 타입 잔여 세대 히트맵 (단일 색상 명도 단계) */
export function RemainingGrid({ buildings, types, cells }: { buildings: string[]; types: string[]; cells: Record<string, number> }) {
  const values = Object.values(cells);
  if (!values.length) return <Empty note="모든 세대가 계약완료 상태입니다." />;
  const max = Math.max(...values);
  const ramp = ["var(--q1)", "var(--q2)", "var(--q3)", "var(--q4)", "var(--q5)"];
  return (
    <div className={styles.gridScroll}>
      <table className={styles.heat}>
        <thead>
          <tr><th scope="col">동</th>{types.map((t) => <th key={t} scope="col">{t}</th>)}<th scope="col">합계</th></tr>
        </thead>
        <tbody>
          {buildings.map((b) => {
            const sum = types.reduce((s, t) => s + (cells[`${b}|${t}`] ?? 0), 0);
            return (
              <tr key={b}>
                <th scope="row">{b}동</th>
                {types.map((t) => {
                  const v = cells[`${b}|${t}`] ?? 0;
                  const level = v ? Math.min(4, Math.floor((v / max) * 4.999)) : -1;
                  return (
                    <td key={t} title={`${b}동 ${t}: 잔여 ${v}세대`}
                      style={level >= 0 ? { background: ramp[level], color: level >= 3 ? "var(--q-ink)" : undefined } : undefined}
                      className={v ? undefined : styles.zero}>
                      {v || "–"}
                    </td>
                  );
                })}
                <td className={styles.sum}>{sum}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

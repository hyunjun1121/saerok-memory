const COLORS = Object.freeze({
  ink: "#2F2A24",
  muted: "#706A61",
  paper: "#FFFDF7",
  cream: "#F7F0DE",
  green: "#427A4A",
  greenSoft: "#DCEAD7",
  amber: "#E59A35",
  amberSoft: "#F8E5BE",
  red: "#B95B4D",
  redSoft: "#F4D8D1",
  blue: "#4F79A7",
  blueSoft: "#DCE8F2",
  gray: "#D9D5CC",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(value, digits = 1) {
  const number = finite(value);
  return number === null ? "—" : `${(number * 100).toFixed(digits)}%`;
}

function millis(value) {
  const number = finite(value);
  if (number === null) return "—";
  return number >= 1000 ? `${(number / 1000).toFixed(1)}초` : `${Math.round(number)}ms`;
}

function signedPercentagePoints(value) {
  const number = finite(value);
  if (number === null) return "—";
  const points = number * 100;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)}%p`;
}

function svgShell(title, subtitle, body, { width = 1200, height = 675 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
  <rect width="${width}" height="${height}" rx="28" fill="${COLORS.paper}"/>
  <text x="54" y="62" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="30" font-weight="800">${escapeHtml(title)}</text>
  <text x="54" y="94" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="17">${escapeHtml(subtitle)}</text>
  ${body}
  <text x="54" y="646" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="15">Haru 음성 UX · 샘플 데이터 · 20명 × 7일</text>
</svg>`;
}

function dailyRetentionSvg(analysis) {
  const rows = Array.isArray(analysis.dailyFunnel) ? analysis.dailyFunnel : [];
  const max = Math.max(1, ...rows.map((row) => row.eligible ?? 0));
  const chartTop = 145;
  const chartHeight = 390;
  const chartLeft = 86;
  const chartWidth = 1050;
  const groupWidth = chartWidth / Math.max(1, rows.length);
  const bars = rows
    .map((row, index) => {
      const startedHeight = ((row.started ?? 0) / max) * chartHeight;
      const completedHeight = ((row.completed ?? 0) / max) * chartHeight;
      const x = chartLeft + groupWidth * index + 22;
      const base = chartTop + chartHeight;
      return `<g>
        <rect x="${x}" y="${base - startedHeight}" width="44" height="${startedHeight}" rx="8" fill="${COLORS.amberSoft}"/>
        <rect x="${x + 48}" y="${base - completedHeight}" width="44" height="${completedHeight}" rx="8" fill="${COLORS.green}"/>
        <text x="${x + 46}" y="${base + 30}" text-anchor="middle" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="17" font-weight="700">${row.day}일</text>
        <text x="${x + 22}" y="${base - startedHeight - 10}" text-anchor="middle" fill="${COLORS.muted}" font-family="Arial, sans-serif" font-size="15">${row.started ?? 0}</text>
        <text x="${x + 70}" y="${base - completedHeight - 10}" text-anchor="middle" fill="${COLORS.green}" font-family="Arial, sans-serif" font-size="15" font-weight="700">${row.completed ?? 0}</text>
      </g>`;
    })
    .join("\n");
  const body = `<line x1="${chartLeft}" y1="${chartTop + chartHeight}" x2="${chartLeft + chartWidth}" y2="${chartTop + chartHeight}" stroke="${COLORS.gray}" stroke-width="2"/>
  ${bars}
  <g transform="translate(850 112)">
    <rect width="18" height="18" rx="4" fill="${COLORS.amberSoft}"/><text x="27" y="15" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="16">시작</text>
    <rect x="100" width="18" height="18" rx="4" fill="${COLORS.green}"/><text x="127" y="15" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="16">완료</text>
  </g>`;
  return svgShell("7일 참여 흐름", "일자별 루틴 시작·완료 인원", body);
}

function participantWeekSvg(analysis) {
  const rows = Array.isArray(analysis.participantMatrix) ? analysis.participantMatrix.slice(0, 20) : [];
  const color = {
    completed: COLORS.green,
    resumed: COLORS.blue,
    returned_after_voice_dropoff: COLORS.blue,
    partial: COLORS.amber,
    dropoff: COLORS.red,
    absent: COLORS.gray,
  };
  const startX = 280;
  const startY = 140;
  const cellWidth = 112;
  const cellHeight = 22;
  const cells = rows
    .map((row, rowIndex) => {
      const y = startY + rowIndex * 23;
      const label = `<text x="252" y="${y + 16}" text-anchor="end" fill="${COLORS.muted}" font-family="Arial, sans-serif" font-size="14">${escapeHtml(row.participantId)}</text>`;
      const days = (row.days ?? [])
        .slice(0, 7)
        .map(
          (status, dayIndex) =>
            `<rect x="${startX + dayIndex * cellWidth}" y="${y}" width="${cellWidth - 5}" height="${cellHeight}" rx="5" fill="${color[status] ?? COLORS.gray}"/>`,
        )
        .join("");
      return `${label}${days}`;
    })
    .join("\n");
  const headers = Array.from(
    { length: 7 },
    (_, index) =>
      `<text x="${startX + index * cellWidth + (cellWidth - 5) / 2}" y="126" text-anchor="middle" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="16" font-weight="700">${index + 1}일</text>`,
  ).join("");
  const legend = [
    ["completed", "완료"],
    ["returned_after_voice_dropoff", "음성 이탈 후 익일 복귀"],
    ["partial", "부분"],
    ["dropoff", "이탈 관찰"],
    ["absent", "미참여"],
  ]
    .map(
      ([status, label], index) =>
        `<g transform="translate(${305 + index * 150} 610)"><rect width="16" height="16" rx="4" fill="${color[status]}"/><text x="24" y="14" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="14">${label}</text></g>`,
    )
    .join("");
  return svgShell("참여자별 7일 궤적", "20명 상태를 같은 기준으로 비교", `${headers}${cells}${legend}`);
}

function sttComparisonSvg(analysis) {
  const variants = Array.isArray(analysis.stt?.variants) ? analysis.stt.variants : [];
  const metrics = [
    ["usableTranscriptRate", "사용 가능 전사율", false],
    ["semanticSlotPreservationRate", "의미 단서 보존", false],
    ["noSpeechRate", "무음 판정", true],
    ["retryRate", "재시도", true],
  ];
  const startX = 290;
  const startY = 160;
  const rowHeight = 92;
  const maxWidth = 700;
  const body = metrics
    .map(([key, label, lowerIsBetter], metricIndex) => {
      const y = startY + metricIndex * rowHeight;
      const bars = variants
        .map((variant, variantIndex) => {
          const value = finite(variant[key]) ?? 0;
          const barY = y + variantIndex * 31;
          const barColor = variant.variantKind === "assist" ? COLORS.green : COLORS.amber;
          return `<rect x="${startX}" y="${barY}" width="${Math.max(2, value * maxWidth)}" height="23" rx="6" fill="${barColor}"/>
            <text x="${startX + value * maxWidth + 10}" y="${barY + 17}" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="15" font-weight="700">${pct(value)}</text>`;
        })
        .join("");
      return `<text x="255" y="${y + 19}" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="17" font-weight="700">${label}</text>
        <text x="255" y="${y + 44}" text-anchor="end" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="13">${lowerIsBetter ? "낮을수록 좋음" : "높을수록 좋음"}</text>${bars}`;
    })
    .join("\n");
  const legend = variants
    .map(
      (variant, index) =>
        `<g transform="translate(${760 + index * 190} 112)"><rect width="17" height="17" rx="4" fill="${variant.variantKind === "assist" ? COLORS.green : COLORS.amber}"/><text x="25" y="15" fill="${COLORS.muted}" font-family="Arial, sans-serif" font-size="15">${escapeHtml(variant.variant)}</text></g>`,
    )
    .join("");
  return svgShell(
    "STT 사용성 비교",
    "주 지표: 후속 기억 단서에 활용 가능한 전사 비율",
    `${legend}${body}`,
  );
}

function dropoutHotspotsSvg(analysis) {
  const rows = Array.isArray(analysis.dropoutHotspots) ? analysis.dropoutHotspots.slice(0, 8) : [];
  const max = Math.max(1, ...rows.map((row) => row.dropouts ?? 0));
  const startX = 260;
  const startY = 145;
  const width = 800;
  const body = rows.length
    ? rows
        .map((row, index) => {
          const y = startY + index * 55;
          const value = row.dropouts ?? 0;
          const barWidth = (value / max) * width;
          return `<text x="235" y="${y + 24}" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="17" font-weight="700">${escapeHtml(row.questionId)}</text>
            <rect x="${startX}" y="${y}" width="${Math.max(4, barWidth)}" height="32" rx="8" fill="${COLORS.redSoft}"/>
            <rect x="${startX}" y="${y}" width="${Math.max(4, barWidth)}" height="32" rx="8" fill="${COLORS.red}" opacity="0.82"/>
            <text x="${startX + barWidth + 12}" y="${y + 23}" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="15">${value}건 · ${pct(row.dropoutRate)}</text>`;
        })
        .join("\n")
    : `<text x="600" y="330" text-anchor="middle" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="22">관찰된 문항 이탈 없음</text>`;
  return svgShell("문항 이탈 집중 구간", "제시된 문항 중 미완료·무효·건너뜀을 합산", body);
}

function questionTimingSvg(analysis) {
  const rows = (Array.isArray(analysis.questionMetrics) ? analysis.questionMetrics : [])
    .filter((row) => finite(row.activeDurationP50Ms) !== null)
    .sort(
      (left, right) =>
        (finite(right.activeDurationP50Ms) ?? 0) - (finite(left.activeDurationP50Ms) ?? 0),
    )
    .slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => finite(row.activeDurationP90Ms) ?? 0));
  const startX = 270;
  const startY = 145;
  const width = 760;
  const body = rows.length
    ? rows
        .map((row, index) => {
          const y = startY + index * 55;
          const p50 = finite(row.activeDurationP50Ms) ?? 0;
          const p90 = finite(row.activeDurationP90Ms) ?? p50;
          const medianWidth = (p50 / max) * width;
          const p90X = startX + (p90 / max) * width;
          return `<text x="245" y="${y + 24}" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="17" font-weight="700">${escapeHtml(row.questionId)}</text>
            <rect x="${startX}" y="${y}" width="${Math.max(4, medianWidth)}" height="31" rx="8" fill="${COLORS.blue}" opacity="0.88"/>
            <line x1="${p90X}" y1="${y - 4}" x2="${p90X}" y2="${y + 35}" stroke="${COLORS.ink}" stroke-width="3"/>
            <circle cx="${p90X}" cy="${y + 15.5}" r="5" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="3"/>
            <text x="${Math.min(1115, p90X + 12)}" y="${y + 22}" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="14">${millis(p50)} / ${millis(p90)}</text>`;
        })
        .join("\n")
    : `<text x="600" y="330" text-anchor="middle" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="22">문항 시간 기록 없음</text>`;
  const legend = `<g transform="translate(760 112)"><rect width="22" height="14" rx="4" fill="${COLORS.blue}"/><text x="30" y="13" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="14">active p50</text><line x1="130" y1="-3" x2="130" y2="18" stroke="${COLORS.ink}" stroke-width="3"/><text x="143" y="13" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="14">p90</text></g>`;
  return svgShell("오래 걸린 문항", "active 시간 p50 / p90 · 멈춰 둔 시간 제외", `${legend}${body}`);
}

function cohortCompletionSvg(analysis) {
  const dimensions = [
    ["ageBand", "연령대", COLORS.green],
    ["voiceChallengeBand", "음성 난이도", COLORS.blue],
    ["voiceExperienceVariant", "음성 조건", COLORS.amber],
  ];
  const rows = dimensions.flatMap(([key, label, color]) =>
    (Array.isArray(analysis.cohorts?.[key]) ? analysis.cohorts[key] : [])
      .filter(
        (row) =>
          row.suppressed !== true &&
          row.value !== "unknown" &&
          (row.participantCount ?? 0) > 0,
      )
      .map((row) => ({ ...row, dimensionLabel: label, color })),
  );
  const startX = 360;
  const startY = 145;
  const width = 660;
  const body = rows.length
    ? rows
        .slice(0, 9)
        .map((row, index) => {
          const y = startY + index * 51;
          const value = finite(row.sessionCompletionRate) ?? 0;
          return `<text x="330" y="${y + 22}" text-anchor="end" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="15" font-weight="700">${escapeHtml(row.dimensionLabel)} · ${escapeHtml(row.value)}</text>
            <rect x="${startX}" y="${y}" width="${width}" height="28" rx="8" fill="${COLORS.gray}" opacity="0.42"/>
            <rect x="${startX}" y="${y}" width="${Math.max(4, value * width)}" height="28" rx="8" fill="${row.color}" opacity="0.88"/>
            <text x="${startX + width + 14}" y="${y + 21}" fill="${COLORS.ink}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="14">${pct(value)} · n=${row.participantCount}</text>`;
        })
        .join("\n")
    : `<text x="600" y="330" text-anchor="middle" fill="${COLORS.muted}" font-family="Arial, 'Noto Sans KR', sans-serif" font-size="22">n≥3 cohort 없음</text>`;
  return svgShell("Cohort별 세션 완료", "n<3 집단은 숨김 · 차이는 원인 해석 금지", body);
}

export function renderStaticCharts(analysis) {
  return {
    "01_daily_retention.svg": dailyRetentionSvg(analysis),
    "02_participant_week.svg": participantWeekSvg(analysis),
    "03_stt_variant_comparison.svg": sttComparisonSvg(analysis),
    "04_question_dropoff_hotspots.svg": dropoutHotspotsSvg(analysis),
    "05_question_timing.svg": questionTimingSvg(analysis),
    "06_cohort_completion.svg": cohortCompletionSvg(analysis),
  };
}

function kpi(label, value, note = "") {
  return `<article class="kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}</article>`;
}

function chartCard(captureName, title, svg) {
  return `<section class="chart-card" data-capture="${escapeHtml(captureName)}"><h2>${escapeHtml(title)}</h2><div class="svg-wrap">${svg}</div></section>`;
}

function variantTable(analysis) {
  const rows = Array.isArray(analysis.stt?.variants) ? analysis.stt.variants : [];
  return `<div class="table-wrap"><table><thead><tr><th>조건</th><th>전사 사용 가능</th><th>CER</th><th>WER</th><th>의미 단서 보존</th><th>무음</th><th>재시도</th><th>지연 p50 / p90</th></tr></thead><tbody>${rows
    .map(
      (row) => `<tr><th>${escapeHtml(row.variant)}</th><td>${pct(row.usableTranscriptRate)}</td><td>${pct(row.characterErrorRate)}</td><td>${pct(row.wordErrorRate)}</td><td>${pct(row.semanticSlotPreservationRate)}</td><td>${pct(row.noSpeechRate)}</td><td>${pct(row.retryRate)}</td><td>${millis(row.latencyP50Ms)} / ${millis(row.latencyP90Ms)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function prioritizedActions(analysis) {
  const hotspot = analysis.dropoutHotspots?.[0];
  const voiceRate = analysis.voiceOperational?.dropoutRate;
  const paired = analysis.stt?.paired ?? {};
  const items = [
    hotspot
      ? `${hotspot.questionId} 도달 후 이탈 ${hotspot.dropouts}건(${pct(hotspot.dropoutRate)}). 안내 길이·확인 단계·입력 실패를 실제 관찰로 분리 측정.`
      : "문항 이탈 표본이 없음. 실제 파일럿에서 도달 대비 완료율부터 확인.",
    `음성 문항 운영 이탈 ${pct(voiceRate)}. 권한 거부, no-speech, STT 실패, 사용자 취소를 별도 원인 코드로 검토.`,
    `보정 조건의 사용 가능한 전사 변화 ${signedPercentagePoints(paired.usableTranscriptRateDelta)}. 같은 지표로 후속 음성 검토를 이어서 확인.`,
    "집단별 n<3은 표시 억제. 작은 집단 차이를 개인 특성이나 원인으로 해석하지 않음.",
  ];
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function assistIntervention(analysis) {
  const waveHeights = [22, 40, 66, 36, 82, 54, 94, 48, 72, 32, 88, 58, 100, 46, 78, 38, 64, 28];
  const waveform = waveHeights
    .map((height) => `<span style="height:${height}%"></span>`)
    .join("");
  const preprocessing = analysis.stt?.preprocessing?.assist ?? "haru-dc-hp80-rms-v2";
  return `<section class="intervention" data-capture="assist-intervention">
    <div class="intervention-head">
      <div><span class="intervention-kicker">assist_v2에 넣은 개선</span><h2>말하기 부담과 입력 불확실성을 함께 줄이는 구성</h2></div>
      <span class="sample-chip">샘플 데이터</span>
    </div>
    <div class="intervention-grid">
      <div class="wave-panel">
        <div class="waveform" aria-label="빨간 실시간 파형 모티프">${waveform}</div>
        <strong>말하는 동안 입력 반응을 바로 확인</strong>
        <p>빨간 파형으로 마이크가 반응하는 느낌을 즉시 보여줍니다.</p>
      </div>
      <article><b>01 · 안내 문장</b><strong>또박또박 말하려 애쓰지 않아도 됩니다.<br/>평소처럼 편하게 말씀하세요.</strong><p>정답처럼 말해야 한다는 부담을 낮추는 방향입니다.</p></article>
      <article><b>02 · 같은 Qwen 모델</b><strong>${escapeHtml(preprocessing)}</strong><p>DC 제거·80 Hz high-pass·bounded RMS 입력 보정만 비교합니다.</p></article>
      <article><b>03 · 확인할 결과</b><strong>사용 가능한 전사 · no-speech · 재시도 · 이탈 · 지연</strong><p>음성 UX 전후 변화를 같은 기준으로 비교합니다.</p></article>
    </div>
  </section>`;
}

export function renderDashboardHtml(analysis) {
  const charts = renderStaticCharts(analysis);
  const overview = analysis.overview ?? {};
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Haru 7일 음성 사용 데이터 분석</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif; background:#f1ebdc; color:#2f2a24; }
    * { box-sizing:border-box; }
    body { margin:0; background:linear-gradient(180deg,#ece2cb 0,#f7f2e7 28rem); }
    main { width:min(1440px,calc(100% - 32px)); margin:0 auto; padding:40px 0 72px; }
    header { display:grid; gap:14px; padding:34px; border:1px solid #dacfb8; border-radius:30px; background:#fffdf7; box-shadow:0 20px 50px rgba(74,57,32,.09); }
    .eyebrow { color:#427a4a; font-size:14px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(34px,5vw,64px); line-height:1.04; letter-spacing:-.045em; }
    header p { max-width:900px; margin:0; color:#625d55; font-size:18px; line-height:1.65; font-weight:650; }
    .kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin:22px 0; }
    .kpi { min-height:136px; padding:19px; border:1px solid #ded7c9; border-radius:22px; background:#fffdf7; display:flex; flex-direction:column; justify-content:space-between; }
    .kpi span,.kpi small { color:#706a61; font-size:14px; font-weight:750; }
    .kpi strong { font-size:32px; letter-spacing:-.04em; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
    .chart-card,.section { overflow:hidden; padding:22px; border:1px solid #ded7c9; border-radius:26px; background:#fffdf7; box-shadow:0 10px 30px rgba(74,57,32,.06); }
    .chart-card h2,.section h2 { margin:0 0 14px; font-size:22px; }
    .svg-wrap svg { display:block; width:100%; height:auto; }
    .section { margin-top:18px; }
    .table-wrap { overflow:auto; }
    table { width:100%; border-collapse:collapse; min-width:940px; }
    th,td { padding:14px 12px; border-bottom:1px solid #e8e1d5; text-align:right; font-variant-numeric:tabular-nums; }
    th:first-child,td:first-child { text-align:left; }
    thead th { color:#706a61; font-size:13px; }
    ol { margin:0; padding-left:24px; display:grid; gap:12px; color:#4f4941; font-size:17px; line-height:1.55; font-weight:650; }
    .intervention { margin:0 0 20px; padding:28px; border:1px solid #d8c8b5; border-radius:28px; background:#fff9ee; box-shadow:0 12px 36px rgba(74,57,32,.07); }
    .intervention-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:20px; }
    .intervention-head h2 { max-width:850px; margin:6px 0 0; font-size:30px; letter-spacing:-.035em; }
    .intervention-kicker { color:#a34539; font-size:14px; font-weight:900; letter-spacing:.08em; }
    .sample-chip { flex:none; padding:8px 12px; border-radius:999px; background:#dcead7; color:#2f6538; font-size:13px; font-weight:850; }
    .intervention-grid { display:grid; grid-template-columns:1.25fr repeat(3,1fr); gap:12px; }
    .intervention-grid article,.wave-panel { min-height:205px; padding:18px; border:1px solid #e7d8c6; border-radius:20px; background:#fffdf7; }
    .intervention-grid article { display:flex; flex-direction:column; gap:12px; }
    .intervention-grid b { color:#a34539; font-size:13px; letter-spacing:.04em; }
    .intervention-grid strong { font-size:18px; line-height:1.45; }
    .intervention-grid p { margin:auto 0 0; color:#706a61; font-size:14px; line-height:1.5; font-weight:650; }
    .wave-panel { background:#402523; color:#fff9ee; }
    .wave-panel p { color:#efd8d1; }
    .waveform { height:92px; display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:15px; }
    .waveform span { width:7px; min-height:8px; border-radius:999px; background:#ef6655; box-shadow:0 0 12px rgba(239,102,85,.3); }
    footer { margin-top:24px; color:#706a61; font-size:14px; line-height:1.6; }
    @media (max-width:1050px) { .kpis { grid-template-columns:repeat(3,1fr); } .grid { grid-template-columns:1fr; } .intervention-grid { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:620px) { main { width:min(100% - 20px,1440px); padding-top:10px; } header { padding:24px; } .kpis { grid-template-columns:repeat(2,1fr); } .kpi { min-height:118px; } }
  </style>
</head>
<body>
<main>
  <header data-capture="overview">
    <div class="eyebrow">Haru · 20명 × 7일 샘플 데이터</div>
    <h1>음성 사용 흐름과<br/>개선 지점을 한눈에</h1>
    <p>참여·이탈·문항 시간·재시도·STT 흐름을 같은 기준으로 묶었습니다. 핵심 지표는 <strong>후속 기억 단서에 활용 가능한 전사 비율</strong>입니다.</p>
  </header>
  <section class="kpis">
    ${kpi("참여자", `${overview.participantCount ?? 0}명`, "10개 비교 쌍")}
    ${kpi("1일차 완료", `${overview.day1Completed ?? 0}/${overview.day1Started ?? 0}`, "시작자 기준")}
    ${kpi("익일 복귀", pct(overview.nextDayReturnRate), `음성 이탈 ${analysis.voiceOperational?.nextDayReturnEligibleCount ?? 0}건 기준`)}
    ${kpi("7일차 완료", `${overview.day7Completed ?? 0}명`, "일자별 참여 흐름")}
    ${kpi("7일 완주", `${overview.fullWeekCompletedParticipantCount ?? 0}명`, "7일 모두 완료")}
    ${kpi("음성 이탈", pct(analysis.voiceOperational?.dropoutRate), `${analysis.voiceOperational?.dropoutCount ?? 0}건`)}
  </section>
  ${assistIntervention(analysis)}
  <div class="grid">
    ${chartCard("retention", "참여·완료 유지", charts["01_daily_retention.svg"])}
    ${chartCard("participant-week", "개별 참여 궤적", charts["02_participant_week.svg"])}
    ${chartCard("stt-comparison", "음성 보정 조건 비교", charts["03_stt_variant_comparison.svg"])}
    ${chartCard("dropoff-hotspots", "이탈 집중 문항", charts["04_question_dropoff_hotspots.svg"])}
    ${chartCard("question-timing", "문항별 active 시간", charts["05_question_timing.svg"])}
    ${chartCard("cohorts", "Cohort 비교", charts["06_cohort_completion.svg"])}
  </div>
  <section class="section" data-capture="stt-table"><div class="intervention-head"><h2>STT 세부 지표</h2><span class="sample-chip">샘플 데이터</span></div>${variantTable(analysis)}</section>
  <section class="section" data-capture="actions"><div class="intervention-head"><h2>개선 우선순위</h2><span class="sample-chip">샘플 데이터</span></div>${prioritizedActions(analysis)}</section>
  <footer>샘플 데이터 · seed: ${escapeHtml(analysis.seed ?? "—")} · generatedAt: ${escapeHtml(analysis.generatedAt ?? "—")}</footer>
</main>
</body>
</html>`;
}

function variantByKind(analysis, kind) {
  return analysis.stt?.variants?.find((variant) => variant.variantKind === kind) ?? null;
}

export function renderFindingsMarkdown(analysis) {
  const overview = analysis.overview ?? {};
  const assist = variantByKind(analysis, "assist");
  const baseline = variantByKind(analysis, "baseline");
  const paired = analysis.stt?.paired ?? {};
  const hotspot = analysis.dropoutHotspots?.[0];
  return `# Haru 20명 × 7일 샘플 데이터 분석 결과

## 요약

- 참여자: ${overview.participantCount ?? 0}명. 1일차 시작 ${overview.day1Started ?? 0}명, 완료 ${overview.day1Completed ?? 0}명.
- 음성 단계 이탈 후 익일 복귀: ${analysis.voiceOperational?.nextDayReturnedCount ?? 0}/${analysis.voiceOperational?.nextDayReturnEligibleCount ?? 0} (${pct(overview.nextDayReturnRate)}). 7일차 완료: ${overview.day7Completed ?? 0}명. 7일 완주: ${overview.fullWeekCompletedParticipantCount ?? 0}명.
- 음성 문항 운영 이탈: ${analysis.voiceOperational?.dropoutCount ?? 0}/${analysis.voiceOperational?.voiceAttemptCount ?? 0} (${pct(analysis.voiceOperational?.dropoutRate)}).
${hotspot ? `- 가장 큰 문항 이탈 집중 구간: ${hotspot.questionId}, ${hotspot.dropouts}건/${hotspot.presented}회 제시 (${pct(hotspot.dropoutRate)}).` : "- 관찰된 문항 이탈 집중 구간 없음."}

## STT 사용성 비교

주 지표는 **사용 가능 전사율**이다. 후속 기억 단서 작성에 활용 가능한 전사를 전체 음성 문항 기준으로 계산한다.

| 조건 | 사용 가능 전사율 | CER | WER | 의미 단서 보존 | no-speech | 재시도 | 지연 p50 / p90 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${[baseline, assist]
  .filter(Boolean)
  .map((row) => `| ${row.variant} | ${pct(row.usableTranscriptRate)} | ${pct(row.characterErrorRate)} | ${pct(row.wordErrorRate)} | ${pct(row.semanticSlotPreservationRate)} | ${pct(row.noSpeechRate)} | ${pct(row.retryRate)} | ${millis(row.latencyP50Ms)} / ${millis(row.latencyP90Ms)} |`)
  .join("\n")}

대응되는 ${paired.pairCount ?? 0}쌍에서 보정 조건의 사용 가능 전사율 변화는 ${signedPercentagePoints(paired.usableTranscriptRateDelta)}, no-speech 변화는 ${signedPercentagePoints(paired.noSpeechRateDelta)}, 중앙 지연 변화는 ${millis(paired.latencyMedianDeltaMs)}다.

## assist_v2에 넣은 개선

- **빨간 파형:** 말하는 동안 입력 반응을 바로 확인하게 한다.
- **부담을 낮춘 안내:** “또박또박 말하려 애쓰지 않아도 됩니다. 평소처럼 편하게 말씀하세요.”
- **같은 Qwen 모델의 입력 보정:** ${escapeHtml(analysis.stt?.preprocessing?.assist ?? "haru-dc-hp80-rms-v2")}로 DC 제거·80 Hz high-pass·bounded RMS를 적용한다.

## 개선 후보

1. ${hotspot ? `${hotspot.questionId}에서 안내·확인 단계·입력 실패 원인을 telemetry 코드별로 분리한다.` : "실제 파일럿에서 문항 도달 대비 완료율을 먼저 확인한다."}
2. 음성 문항에서 권한 거부, no-speech, STT 실패, 사용자 취소를 분리하고 재시도 후 완료까지 연결한다.
3. baseline **${escapeHtml(analysis.stt?.preprocessing?.baseline ?? "—")}**와 assist **${escapeHtml(analysis.stt?.preprocessing?.assist ?? "—")}**를 동일 입력에 적용해 전사 품질 변화를 계속 확인한다.
4. 집단별 셀 n<3은 숨기고, 작은 집단 차이를 개인 원인으로 설명하지 않는다.

## 활용 기준

- 임상 상태, 질환, 인지 저하를 추론하지 않는다.
- 이탈·STT 지표는 제품 흐름과 음성 UX 개선에만 활용한다.
- 후속 데이터에서도 같은 지표와 오류 원인 코드를 유지한다.
`;
}

export function renderMethodologyMarkdown(analysis) {
  return `# Haru 음성 사용 데이터 분석 기준

## 목적

20명 × 7일 샘플 데이터에서 참여·이탈·문항 시간·재시도·STT 흐름을 같은 기준으로 분석한다. 입력은 \`dataKind="sample"\`을 사용한다.

## 입력 계약

\`operational_export.json\` 최상위:

- \`schemaVersion\`, \`generatedAt\`, \`dataKind\`, \`seed\`
- \`participants[]\`, \`consentReceipts[]\`, \`routineSessions[]\`
- \`questionAttempts[]\`, \`telemetryEvents[]\`

\`restricted/stt_review_rows.json\`에는 transcript가 있는 \`rows[]\`만 분리 보관한다. 일반 운영 export에 STT review row를 넣지 않는다.

STT review row:

- 결합 키: \`participantId\`, \`pairId\`, \`voiceExperienceVariant\`, \`day\`, \`questionId\`, \`sessionId\`
- 운영값: \`status\`, \`noSpeech\`, \`retryCount\`, \`latencyMs\`, \`audioDurationMs\`
- restricted fields: \`referenceTranscript\`, \`hypothesisTranscript\`, \`usableTranscript\`, \`semanticSlots[]\`
- 재현 metadata: \`engine\`, \`model\`, \`modelRevision\`, \`preprocessingVersion\`

\`voiceExperienceVariant\`는 \`baseline_v1\`과 \`assist_v2\`를 사용한다. baseline은 decode/resample-only metadata, assist는 현재 \`${analysis.stt?.preprocessing?.assist ?? "haru-dc-hp80-rms-v2"}\` metadata다.

## 지표 정의

- **사용 가능 전사율(주 지표):** \`usableTranscript=true / 전체 STT review rows\`. no-speech와 실패를 분모에 포함한다.
- **CER:** NFKC 정규화 후 공백·문장부호를 제외한 문자 단위 Levenshtein edit 합 / reference 문자 합.
- **WER:** 공백 토큰 단위 edit 합 / reference token 합. 일본어처럼 공백 없는 전사는 참고값이며 형태소 WER이 아니다.
- **semantic slot preservation:** explicit \`semanticSlots[]\`의 preserved/전체. slot이 없을 때 lexical token proxy를 사용하고 결과에 출처를 남긴다.
- **no-speech:** \`noSpeech=true\` 또는 status \`no_speech\` 비율.
- **retry:** \`retryCount>0\`인 review row 비율.
- **voice dropout:** 제시된 voice attempt 중 completedAt 없음, invalid, 또는 skipReason 존재 비율.
- **latency:** \`latencyMs\`의 p50과 선형보간 p90.
- **익일 복귀:** 1~6일차 음성 단계에서 이탈한 참여자-일 중 같은 참여자가 바로 다음 날 session을 시작한 비율. 한 사람이 여러 날 이탈하면 각 참여자-일을 별도 관측한다.

## 비교 방법

동일 \`pairId\`에서 baseline과 assist가 모두 존재할 때만 paired delta를 계산한다. 유의성 검정과 신뢰구간은 적용하지 않는다. 후속 분석에서도 동일 입력의 두 decode, blind human review, 원인별 실패 annotation을 유지한다.

## 개인정보·노출 통제

- 계산 결과 \`metrics.json\`, HTML, Markdown, SVG에는 transcript와 음성 object key를 넣지 않는다.
- PNG 캡처에도 reference/hypothesis/semantic expectedValues를 넣지 않는다.
- cohort는 n < 3이면 suppressed 처리한다.
- 운영 적용 시 동의·국가별 저장·삭제 정책을 별도로 검증한다.
`;
}

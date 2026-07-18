// =====================================================================
// MarketEngine —— 全局大势量化引擎（模块1）
// 内置量化判定标准（不可修改）：
//   ① 走熊概率区间定义
//   ② 风险等级匹配规则
//   ③ 5类行情阶段量化规则
//   ④ 科创周期修正规则（对比大盘标准缩短 40%）
// 输入：MARKET_TREND_SEED（大盘/科创板块特征）；单只由 riskengine 传参
// 输出：风险等级 / 走熊概率 / 行情阶段 / 持续时长 / 量化因子佐证
// =====================================================================

const MarketEngine = (function () {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 5类行情阶段定义
  const STAGE = {
    uptrend:   "上升趋势",
    wash:      "洗盘调整",
    top:       "顶部出货",
    downtrend: "下跌趋势",
    bottom:    "底部磨底"
  };

  // 5档风险等级
  const RISK = {
    "极低":  { key: "极低",  color: "#27ae60", desc: "极低风险" },
    "低":    { key: "低",    color: "#52c41a", desc: "低风险" },
    "中性":  { key: "中性",  color: "#f39c12", desc: "中性风险" },
    "高":    { key: "高",    color: "#e67e22", desc: "高风险" },
    "极高":  { key: "极高",  color: "#c0392b", desc: "极高风险" }
  };

  // -----------------------------------------------------------------
  // 行情阶段判定（决策树，严格按 spec ③）
  // -----------------------------------------------------------------
  function detectStage(f) {
    // 底部磨底：大跌后持续地量 + 估值历史低位 + 资金流出放缓
    if (f.afterCrashLowVol && f.valuationLow && f.fundOutflowSlow) return "bottom";
    // 下跌趋势：跌破250日线 + 高低点下移 + 反弹缩量 + 高点回撤≥20%
    if (f.belowMA250 && !f.hhRising && f.reboundVolShrink && f.drawdownPct <= -20) return "downtrend";
    // 顶部出货：高位放量滞涨 + 周线MACD顶背离 + 两融持续增加 + 北向连续流出
    if (f.highVolumeStall && f.weeklyMacdTopDiv && f.marginRising && f.northOutflow) return "top";
    // 洗盘调整：年线支撑 + 缩量回调 + 回撤10%-20% + 长线资金流入
    if (f.yearLineSupport && f.volumeShrink && f.drawdownPct >= -20 && f.drawdownPct <= -10) return "wash";
    // 上升趋势：站稳250日线 + 高低点抬升 + ADX>25 + 60日资金流入 + 回撤<10%
    if (f.aboveMA250 && f.hhRising && f.adx > 25 && f.fund60dInflow > 0 && f.drawdownPct > -10) return "uptrend";
    // 兜底：按特征近似归类
    if (f.belowMA250) return "downtrend";
    if (f.drawdownPct <= -10) return "wash";
    return "uptrend";
  }

  // -----------------------------------------------------------------
  // 走熊概率量化（spec ① 区间，由阶段 + 量化因子微调）
  // -----------------------------------------------------------------
  function computeBearProb(stage, f) {
    const base = { uptrend: 18, wash: 45, top: 68, downtrend: 80, bottom: 35 }[stage];
    let p = base;
    p += clamp((f.adx - 25) * 0.5, -6, 8);                 // ADX 偏离
    p += clamp((Math.abs(f.drawdownPct) - 12) * 0.6, -6, 12); // 回撤深度
    p += clamp(-f.fund60dInflow / 60, -4, 8);              // 60日资金流(净流出→+)
    p += clamp((f.valuationPct - 50) * 0.1, -5, 8);        // 估值分位
    return Math.round(clamp(p, 2, 98));
  }

  // -----------------------------------------------------------------
  // 风险等级匹配（spec ②）
  // -----------------------------------------------------------------
  function matchRisk(bearProb, stage, valuationLow) {
    if (bearProb > 80 && (stage === "downtrend")) return "极高";
    if (bearProb > 80) return "极高";
    if (bearProb >= 60 && bearProb <= 80 && (stage === "top" || stage === "downtrend" || stage === "wash")) return "高";
    if (bearProb >= 40 && bearProb <= 60) return "中性";
    if (bearProb >= 30 && bearProb <= 40 && stage === "wash") return "低";
    if (bearProb < 30 && stage === "uptrend" && valuationLow) return "极低";
    if (bearProb < 30) return "低";
    return "中性";
  }

  // -----------------------------------------------------------------
  // 持续时长（spec ③ + ④ 科创修正 *0.6）
  //   返回 { shortDays:[min,max], midMonths:[min,max], shortText, midText }
  // -----------------------------------------------------------------
  function estimateDuration(stage, isKechuang) {
    const k = isKechuang ? 0.6 : 1.0;
    const map = {
      uptrend:   { d: [5, 10],  m: [3, 8] },
      wash:      { d: [10, 20], m: [0.5, 1] },
      top:       { d: [5, 15],  m: [0.25, 0.75] },
      downtrend: { d: [20, 45], m: [isKechuang ? 4 : 8, isKechuang ? 8 : 12] },
      bottom:    { d: [15, 30], m: [1, 3] }
    }[stage];
    const dmin = Math.max(1, Math.round(map.d[0] * k));
    const dmax = Math.max(dmin, Math.round(map.d[1] * k));
    const mmin = +(map.m[0] * k).toFixed(1);
    const mmax = +(map.m[1] * k).toFixed(1);
    const shortText = `短线 ${dmin}-${dmax} 个交易日`;
    const midText = `中线 ${mmin}-${mmax} 个月`;
    return { shortDays: [dmin, dmax], midMonths: [mmin, mmax], shortText, midText };
  }

  // -----------------------------------------------------------------
  // 量化因子佐证（≥2条）
  // -----------------------------------------------------------------
  function buildFactors(f, stage) {
    const factors = [];
    factors.push({ label: "250日线", value: f.aboveMA250 && !f.belowMA250 ? "站稳" : "跌破", positive: f.aboveMA250 && !f.belowMA250 });
    factors.push({ label: "ADX(趋势强度)", value: f.adx.toFixed(0), positive: f.adx > 25 });
    factors.push({ label: "60日主力净流入", value: (f.fund60dInflow >= 0 ? "+" : "") + f.fund60dInflow + "亿", positive: f.fund60dInflow > 0 });
    factors.push({ label: "阶段高点回撤", value: f.drawdownPct + "%", positive: f.drawdownPct > -10 });
    factors.push({ label: "板块估值分位", value: f.valuationPct + "%", positive: f.valuationPct < 40 });
    if (stage === "top") factors.push({ label: "周线MACD", value: "顶背离", positive: false });
    if (stage === "bottom") factors.push({ label: "量能", value: "持续地量", positive: false });
    return factors;
  }

  // -----------------------------------------------------------------
  // 对外：板块大势（大盘 / 科创）
  // -----------------------------------------------------------------
  function evaluateSector(sectorKey) {
    const seed = MARKET_TREND_SEED[sectorKey];
    if (!seed) return null;
    const isKechuang = sectorKey === "kechuang";
    const f = Object.assign({}, seed);
    const stage = detectStage(f);
    const bearProb = computeBearProb(stage, f);
    const valuationLow = f.valuationLow;
    const riskLevel = matchRisk(bearProb, stage, valuationLow);
    const dur = estimateDuration(stage, isKechuang);
    const factors = buildFactors(f, stage);
    return {
      sectorKey, label: seed.label, isKechuang,
      stageKey: stage, stage: STAGE[stage],
      bearProb, riskLevel, riskColor: RISK[riskLevel].color,
      valuationLow,
      durationShort: dur.shortText, durationMid: dur.midText,
      shortDays: dur.shortDays, midMonths: dur.midMonths,
      factors,
      note: "周期时长仅为历史量化概率预判，若出现重大政策、外围极端行情，周期会缩短或延长。"
    };
  }

  // -----------------------------------------------------------------
  // 对外：全局大势（综合大盘 + 科创；科创优先走弱、大盘相对抗跌）
  // -----------------------------------------------------------------
  function evaluateGlobal() {
    const broad = evaluateSector("broad");
    const kechuang = evaluateSector("kechuang");
    // 全局走熊概率：偏重走弱板块，但大盘抗跌起缓冲
    const bearProb = Math.round(clamp(broad.bearProb * 0.45 + kechuang.bearProb * 0.55, 2, 98));
    // 全局阶段：取更弱板块的阶段
    const weaker = kechuang.bearProb >= broad.bearProb ? kechuang : broad;
    const stage = weaker.stage;
    const stageKey = weaker.stageKey;
    const riskLevel = matchRisk(bearProb, stageKey, broad.valuationLow && kechuang.valuationLow);
    const isKechuang = weaker.isKechuang;
    const dur = estimateDuration(stageKey, isKechuang);
    const factors = [
      { label: "大盘走熊概率", value: broad.bearProb + "%", positive: broad.bearProb < 40 },
      { label: "科创走熊概率", value: kechuang.bearProb + "%", positive: kechuang.bearProb < 40 },
      { label: "大盘行情阶段", value: broad.stage, positive: broad.stageKey === "uptrend" || broad.stageKey === "wash" },
      { label: "科创行情阶段", value: kechuang.stage, positive: kechuang.stageKey === "uptrend" || kechuang.stageKey === "wash" }
    ];
    return {
      bearProb, stage, stageKey, riskLevel, riskColor: RISK[riskLevel].color,
      durationShort: dur.shortText, durationMid: dur.midText,
      shortDays: dur.shortDays, midMonths: dur.midMonths,
      sectors: { broad, kechuang },
      factors,
      note: "周期时长仅为历史量化概率预判，若出现重大政策、外围极端行情，周期会缩短或延长；当前科创优先走弱、大盘相对抗跌。"
    };
  }

  // -----------------------------------------------------------------
  // 对外：单只微观大势（模块1.3 / 模块6）
  //   由 riskengine 传入已计算的 ev（含 grade / changePct / 估值分位等）
  // -----------------------------------------------------------------
  function evaluateMicro(code, ev) {
    const v = (typeof VALUATION_DATA !== 'undefined' && VALUATION_DATA[code]) ? VALUATION_DATA[code] : null;
    const q = QUOTE_DATA[code];
    const isKechuang = (typeof ETF_GROUPS !== 'undefined') && (ETF_GROUPS.star.codes.includes(code));
    // 由单只特征派生大盘级特征子集
    const f = {
      aboveMA250: !(ev.grade === "deep-red" || ev.grade === "light-red"),
      hhRising: ev.grade === "green",
      adx: ev.grade === "deep-red" ? 30 : ev.grade === "light-red" ? 26 : ev.grade === "yellow" ? 22 : 18,
      fund60dInflow: (typeof FUND_FLOW !== 'undefined' && FUND_FLOW[code]) ? FUND_FLOW[code].mainNetInflow * 20 : 0,
      drawdownPct: q.changePct <= -5 ? q.changePct * 3.5 : (q.changePct <= 0 ? q.changePct * 2 : q.changePct * 0.5),
      yearLineSupport: ev.grade !== "deep-red",
      volumeShrink: q.changePct < 0,
      highVolumeStall: ev.grade === "light-red" && v && v.pePercentile >= 70,
      weeklyMacdTopDiv: ev.grade === "light-red",
      marginRising: (typeof MARGIN_DATA !== 'undefined' && MARGIN_DATA[code]) ? MARGIN_DATA[code].change5d > 0 : false,
      northOutflow: (typeof NORTHBOUND_DATA !== 'undefined' && NORTHBOUND_DATA[code]) ? NORTHBOUND_DATA[code].netBuy5d < 0 : false,
      belowMA250: ev.grade === "deep-red",
      reboundVolShrink: ev.grade === "deep-red" || ev.grade === "light-red",
      afterCrashLowVol: false,
      valuationLow: v ? v.pePercentile < 25 : false,
      valuationPct: v ? v.pePercentile : 50,
      fundOutflowSlow: ev.grade === "yellow"
    };
    const stage = detectStage(f);
    const bearProb = computeBearProb(stage, f);
    const riskLevel = matchRisk(bearProb, stage, f.valuationLow);
    const dur = estimateDuration(stage, isKechuang);
    const factors = [
      { label: "综合风险", value: ev.gradeLabel + "·" + ev.gradeAction, positive: ev.grade === "green" || ev.grade === "yellow" },
      { label: "当日涨跌幅", value: q.changePct.toFixed(2) + "%", positive: q.changePct >= 0 },
      { label: "估值分位", value: (v ? v.pePercentile : "-") + "%", positive: v ? v.pePercentile < 40 : true },
      { label: "主力净流入", value: (typeof FUND_FLOW !== 'undefined' && FUND_FLOW[code]) ? FUND_FLOW[code].mainNetInflow.toFixed(2) + "亿" : "-", positive: (typeof FUND_FLOW !== 'undefined' && FUND_FLOW[code]) ? FUND_FLOW[code].mainNetInflow >= 0 : true }
    ];
    return {
      code, stageKey: stage, stage: STAGE[stage],
      bearProb, riskLevel, riskColor: RISK[riskLevel].color,
      durationShort: dur.shortText, durationMid: dur.midText,
      shortDays: dur.shortDays, midMonths: dur.midMonths,
      isKechuang, factors,
      note: "周期时长仅为历史量化概率预判，若出现重大政策、外围极端行情，周期会缩短或延长。"
    };
  }

  // -----------------------------------------------------------------
  // 全局风险强制约束：是否为【极高风险】
  //   ?crisis=1 用于演示/压力测试（强制极高风险，屏蔽全站加仓）
  // -----------------------------------------------------------------
  function isGlobalExtreme(global) {
    const g = global || evaluateGlobal();
    const forced = (typeof window !== 'undefined') && /[?&]crisis=1\b/.test(window.location.search || "");
    return g.riskLevel === "极高" || forced;
  }

  // 行情阶段是否禁止加仓/定投加仓（模块5）
  function stageBlocksAdd(stageKey) {
    return stageKey === "top" || stageKey === "downtrend";
  }

  return {
    evaluateSector, evaluateGlobal, evaluateMicro,
    isGlobalExtreme, stageBlocksAdd,
    RISK, STAGE,
    _internal: { detectStage, computeBearProb, matchRisk, estimateDuration }
  };
})();

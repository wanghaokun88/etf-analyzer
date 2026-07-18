// =====================================================================
// RiskEngine —— 双模式风险分级 + 带数据逻辑的操盘建议引擎
// 原则: 阈值全部来自 data.js 的 THRESHOLDS(2026 A股ETF固定标准),
//       引擎只读阈值, 不自行修改。
// =====================================================================

const RiskEngine = (function () {
  const T = THRESHOLDS;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const statusOf = (good, bad) => good ? "good" : (bad ? "bad" : "neutral");

  function getTech(code) {
    try { return TechnicalEngine.getTechnicalSignals(code); } catch (e) { return null; }
  }

  // 持仓盈亏 / 止损止盈 (分组1专用)
  function getHoldingPnl(code) {
    if (!MY_HOLDINGS.configured) return null;
    const h = MY_HOLDINGS[code];
    if (!h) return null;
    const q = QUOTE_DATA[code];
    const profit = (q.price - h.cost) * h.shares;
    const profitPct = (q.price - h.cost) / h.cost * 100;
    return {
      configured: true, cost: h.cost, shares: h.shares,
      profit, profitPct,
      stopLoss: +(h.cost * (1 + T.holding.stopLossPct / 100)).toFixed(3),
      takeProfit: +(h.cost * (1 + T.holding.takeProfitPct / 100)).toFixed(3),
      addOnDip: +(h.cost * (1 + T.holding.addOnDipPct / 100)).toFixed(3)
    };
  }

  // ---------- 短线波段模式评分 ----------
  function evalShortTerm(code) {
    const q = QUOTE_DATA[code], f = FUND_FLOW[code], iopv = IOPV_DATA[code], ob = ORDER_BOOK[code];
    const tech = getTech(code);
    const st = T.shortTerm;

    // 技术动能分
    let techScore = 50;
    if (tech) {
      techScore += (tech.macdCross === "金叉" ? 22 : tech.macdCross === "死叉" ? -22 : 0);
      techScore += tech.rsiZone === "超卖" ? 18 : tech.rsiZone === "超买" ? -18 : 0;
      techScore += tech.maAlignment.includes("多头") ? 12 : tech.maAlignment.includes("空头") ? -12 : 0;
    }
    techScore = clamp(techScore, 0, 100);

    // 资金流分
    let flowScore;
    if (f.mainNetInflow >= st.mainFlow.strongIn) flowScore = 80;
    else if (f.mainNetInflow >= 0) flowScore = 60;
    else if (f.mainNetInflow >= st.mainFlow.strongOut) flowScore = 42;
    else flowScore = 25;

    // 涨跌幅分
    let chgScore;
    if (q.changePct >= st.changePct.bigUp) chgScore = 80;
    else if (q.changePct >= 0) chgScore = 65;
    else if (q.changePct >= st.changePct.bigDown) chgScore = 40;
    else chgScore = 25;

    // IOPV折溢价分
    let iopvScore = iopv.premiumDeviation > st.premium.arb ? 35 : (iopv.premiumRate < 0 ? 66 : 58);

    // 量比分
    let volScore = ob.volumeRatio > st.volumeRatio.high ? 45 : ob.volumeRatio < st.volumeRatio.low ? 55 : 50;

    const score = clamp(
      techScore * 0.35 + flowScore * 0.30 + chgScore * 0.20 + iopvScore * 0.10 + volScore * 0.05, 0, 100
    );

    const signals = [
      { dim: "技术动能", value: tech ? `${tech.macdCross}/RSI${tech.rsiValue?.toFixed(0)}` : "—", status: statusOf(techScore >= 60, techScore < 40), note: tech ? `MACD${tech.macdCross}, RSI(14)=${tech.rsiValue?.toFixed(1)}, 均线${tech.maAlignment}` : "无" },
      { dim: "主力资金", value: `${f.mainNetInflow.toFixed(2)}亿`, status: statusOf(f.mainNetInflow >= st.mainFlow.strongIn, f.mainNetInflow < st.mainFlow.strongOut), note: f.mainNetInflow >= 0 ? "主力净流入, 短线有支撑" : "主力净流出, 短线承压" },
      { dim: "涨跌幅", value: `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`, status: statusOf(q.changePct >= 0, q.changePct <= st.changePct.bigDown), note: q.changePct >= st.changePct.bigUp ? "强势" : q.changePct <= st.changePct.bigDown ? "跌幅较大" : "震荡" },
      { dim: "IOPV折溢价", value: `${iopv.premiumRate >= 0 ? "+" : ""}${iopv.premiumRate}%`, status: statusOf(iopv.premiumDeviation <= st.premium.arb && iopv.premiumRate <= 0, iopv.premiumDeviation > st.premium.arb), note: iopv.premiumDeviation > st.premium.arb ? "偏离超0.5%, 异常/套利盘" : "折溢价合理" },
      { dim: "量比", value: `${ob.volumeRatio}`, status: "neutral", note: ob.volumeRatio > st.volumeRatio.high ? "放量" : ob.volumeRatio < st.volumeRatio.low ? "缩量" : "正常" }
    ];

    return { score, signals };
  }

  // ---------- 长期定投模式评分 ----------
  function evalLongTerm(code) {
    const q = QUOTE_DATA[code], d = ETF_DETAIL[code], qd = QUARTERLY_DATA[code], v = VALUATION_DATA[code], nb = NORTHBOUND_DATA[code];
    const lt = T.longTerm;

    const peScore = v.pePercentile <= lt.pePercentile.cheap ? 85 : v.pePercentile >= lt.pePercentile.expensive ? 30 : 55;
    const pbScore = v.pbPercentile <= lt.pbPercentile.cheap ? 85 : v.pbPercentile >= lt.pbPercentile.expensive ? 30 : 55;
    const valuation = (peScore + pbScore) / 2;

    const ytdScore = d.yieldYtd <= lt.ytdReturn.cold ? 85 : d.yieldYtd >= lt.ytdReturn.hot ? 30 : 55;
    const ddScore = d.maxDrawdown <= lt.drawdown.deep ? 80 : d.maxDrawdown <= -20 ? 60 : 48;
    const scaleScore = qd.aumChangePct >= lt.scaleGrowth.strong ? 80 : qd.aumChangePct >= 0 ? 60 : 40;
    const teScore = qd.trackError <= lt.trackError.ok ? 72 : 50;
    const nbScore = nb.netBuy5d >= 0 ? 65 : 45;

    const score = clamp(
      valuation * 0.35 + ytdScore * 0.20 + ddScore * 0.10 + scaleScore * 0.15 + teScore * 0.10 + nbScore * 0.10, 0, 100
    );

    const signals = [
      { dim: "估值分位(PE/PB)", value: `PE${v.pePercentile}% / PB${v.pbPercentile}%`, status: statusOf(v.pePercentile <= lt.pePercentile.cheap && v.pbPercentile <= lt.pbPercentile.cheap, v.pePercentile >= lt.pePercentile.expensive), note: v.pePercentile <= lt.pePercentile.cheap ? "历史低位, 定投安全边际高" : v.pePercentile >= lt.pePercentile.expensive ? "估值偏贵" : "估值中性" },
      { dim: "年内收益", value: `${d.yieldYtd >= 0 ? "+" : ""}${d.yieldYtd.toFixed(1)}%`, status: statusOf(d.yieldYtd <= lt.ytdReturn.cold, d.yieldYtd >= lt.ytdReturn.hot), note: d.yieldYtd >= lt.ytdReturn.hot ? "涨幅已大, 定投性价比降" : d.yieldYtd <= lt.ytdReturn.cold ? "深度回调, 摊薄成本低" : "中性" },
      { dim: "最大回撤", value: `${d.maxDrawdown.toFixed(1)}%`, status: statusOf(d.maxDrawdown <= lt.drawdown.deep, false), note: d.maxDrawdown <= lt.drawdown.deep ? "回撤深, 适合分批定投" : "回撤可控" },
      { dim: "规模增长", value: `${qd.aumChangePct >= 0 ? "+" : ""}${qd.aumChangePct}%`, status: statusOf(qd.aumChangePct >= lt.scaleGrowth.strong, qd.aumChangePct < 0), note: qd.aumChangePct >= 0 ? "资金净流入, 趋势认可" : "份额萎缩, 关注" },
      { dim: "跟踪误差", value: `${qd.trackError}%`, status: statusOf(qd.trackError <= lt.trackError.ok, false), note: qd.trackError <= lt.trackError.ok ? "跟踪质量好" : "跟踪误差偏高" },
      { dim: "北向(5日)", value: `${nb.netBuy5d >= 0 ? "+" : ""}${nb.netBuy5d}亿`, status: statusOf(nb.netBuy5d >= 0, nb.netBuy5d < 0), note: nb.netBuy5d >= 0 ? "北向净买入" : "北向净卖出" }
    ];

    return { score, signals };
  }

  // ---------- 评级映射 + 安全覆盖 ----------
  function gradeFromScore(score, code) {
    const q = QUOTE_DATA[code], iopv = IOPV_DATA[code], f = FUND_FLOW[code], st = T.shortTerm;
    let gradeKey;
    if (score >= 65) gradeKey = "green";
    else if (score >= 50) gradeKey = "yellow";
    else if (score >= 35) gradeKey = "light-red";
    else gradeKey = "deep-red";

    // 安全覆盖 (不可修改阈值, 但可叠加硬约束)
    if (q.suspended) return "deep-red"; // 暂停申赎 → 流动性风险
    if (iopv.premiumDeviation > st.premium.arb) gradeKey = gradeKey === "green" ? "light-red" : gradeKey; // 异常折溢价不加仓
    return gradeKey;
  }

  // ---------- 生成可落地建议(每条带数据逻辑) ----------
  function buildAdvices(code, ev, mode, groupId) {
    const q = QUOTE_DATA[code], f = FUND_FLOW[code], iopv = IOPV_DATA[code], v = VALUATION_DATA[code], qd = QUARTERLY_DATA[code], m = MARGIN_DATA[code], nb = NORTHBOUND_DATA[code];
    const name = q.name, price = q.price;
    const advices = [];
    const st = T.shortTerm, lt = T.longTerm;
    const tech = getTech(code);

    // 分组1: 持仓盈亏 / 止损止盈
    if (groupId === "holdings") {
      const pnl = getHoldingPnl(code);
      if (!pnl) {
        advices.push({ priority: "mid", action: `填写 ${name} 成本价`, logic: `data.js 的 MY_HOLDINGS 未配置真实成本/份额, 分组1的盈亏与止损止盈暂不可用(当前为示例配置)` });
      } else {
        if (pnl.profitPct <= T.holding.stopLossPct)
          advices.push({ priority: "high", action: `减仓/清仓 ${name}`, logic: `现价${price}较成本${pnl.cost}回撤${pnl.profitPct.toFixed(1)}%, 已跌破-8%止损线(${pnl.stopLoss}), 控制下行风险优先` });
        else if (pnl.profitPct <= T.holding.addOnDipPct)
          advices.push({ priority: "mid", action: `分批加仓 ${name}`, logic: `浮亏${pnl.profitPct.toFixed(1)}%, 触及-12%加仓区(${pnl.addOnDip}), 可逢低分批吸纳摊薄` });
        else if (pnl.profitPct >= T.holding.takeProfitPct)
          advices.push({ priority: "mid", action: `部分止盈 ${name}`, logic: `浮盈${pnl.profitPct.toFixed(1)}%, 达+20%止盈线(${pnl.takeProfit}), 可了结部分锁定利润` });
        else
          advices.push({ priority: "low", action: `持有观察 ${name}`, logic: `浮盈亏${pnl.profitPct.toFixed(1)}%, 处于止损/止盈区间内, 持有待方向明朗` });
      }
    }

    if (mode === "shortTerm") {
      if (q.suspended) advices.push({ priority: "high", action: `暂停 ${name} 交易`, logic: `该ETF暂停申购赎回, 场内流动性风险高, 暂不操作` });
      if (tech && tech.rsiZone === "超卖") advices.push({ priority: "mid", action: `小仓博反弹 ${name}`, logic: `RSI(14)=${tech.rsiValue?.toFixed(1)}进入超卖区(<30), 技术性反弹概率增大` });
      if (tech && tech.rsiZone === "超买") advices.push({ priority: "mid", action: `不追高 ${name}`, logic: `RSI(14)=${tech.rsiValue?.toFixed(1)}超买(>70), 短线追高性价比低, 等回踩` });
      if (f.mainNetInflow < st.mainFlow.strongOut) advices.push({ priority: "mid", action: `观望 ${name}`, logic: `主力净流出${f.mainNetInflow.toFixed(2)}亿(<${-st.mainFlow.strongOut}亿阈值), 短线承压` });
      if (f.mainNetInflow >= st.mainFlow.strongIn && tech && tech.macdCross === "金叉") advices.push({ priority: "mid", action: `逢低介入 ${name}`, logic: `主力净流入${f.mainNetInflow.toFixed(2)}亿且MACD金叉, 短线动能转强` });
      if (iopv.premiumDeviation > st.premium.arb) advices.push({ priority: "mid", action: `规避 ${name} 异常溢价`, logic: `IOPV折溢价偏离${iopv.premiumDeviation}%(>0.5%阈值), 警惕套利盘/异常波动` });
      if (advices.length === (groupId === "holdings" ? 1 : 0)) advices.push({ priority: "low", action: `区间高抛低吸 ${name}`, logic: `多空信号中性, 当日涨跌${q.changePct.toFixed(2)}%, 适合震荡策略` });
    } else {
      if (v.pePercentile <= lt.pePercentile.cheap && v.pbPercentile <= lt.pbPercentile.cheap)
        advices.push({ priority: "mid", action: `加大定投 ${name}`, logic: `PE分位${v.pePercentile}%/PB分位${v.pbPercentile}%均处历史低位(<30%), 定投安全边际高` });
      else if (v.pePercentile >= lt.pePercentile.expensive)
        advices.push({ priority: "mid", action: `定投放缓 ${name}`, logic: `PE分位${v.pePercentile}%偏高(>70%), 估值偏贵, 减缓定投节奏` });
      else
        advices.push({ priority: "low", action: `正常定投 ${name}`, logic: `PE分位${v.pePercentile}%估值中性, 按原计划定期定额` });
      if (qd.aumChangePct >= lt.scaleGrowth.strong) advices.push({ priority: "low", action: `确认趋势 ${name}`, logic: `规模增长${qd.aumChangePct}%(>10%), 资金持续流入, 长线趋势获认可` });
      if (d_maxDrawdown(code) <= lt.drawdown.deep) advices.push({ priority: "low", action: `分批摊薄 ${name}`, logic: `最大回撤${d_maxDrawdown(code).toFixed(1)}%(<=-30%), 深跌后定投摊薄成本效果更好` });
      if (qd.trackError > lt.trackError.ok) advices.push({ priority: "low", action: `关注跟踪质量 ${name}`, logic: `跟踪误差${qd.trackError}%(>0.5%), 留意跟踪偏离` });
      if (qd.dividendYield > 0) advices.push({ priority: "low", action: `红利再投 ${name}`, logic: `股息率${qd.dividendYield}%, 可提供现金流用于红利再投资` });
    }

    // 两融 / 北向 作为补充观察(两条模式通用)
    if (m.change5d <= -3) advices.push({ priority: "low", action: `关注两融降温 ${name}`, logic: `融资余额5日变动${m.change5d}%(<-3%), 杠杆资金撤退, 动能减弱` });
    if (nb.netBuy5d <= -1) advices.push({ priority: "low", action: `留意北向流出 ${name}`, logic: `北向5日净买${nb.netBuy5d}亿(<=-1亿), 外资边际走弱` });

    // 风险等级总建议
    const gradeKey = ev.grade;
    const gradeAdvice = {
      green: { priority: "high", action: `机会加仓 ${name}`, logic: `综合风险评级「绿-机会加仓」, 多维信号偏多, 可伺机加仓` },
      yellow: { priority: "high", action: `短线博弈 ${name}`, logic: `综合风险评级「黄-短线博弈」, 信号中性, 轻仓快进快出` },
      "light-red": { priority: "high", action: `观望换仓 ${name}`, logic: `综合风险评级「浅红-观望换仓」, 信号转弱, 减仓或调仓至更强标的` },
      "deep-red": { priority: "high", action: `立即减仓清仓 ${name}`, logic: `综合风险评级「深红-立即减仓清仓」, 风险集中释放, 优先控制仓位` }
    }[gradeKey];
    advices.unshift(gradeAdvice);

    // 去重 + 按优先级排序 + 截取
    const seen = new Set(); const uniq = [];
    advices.forEach(a => { if (!seen.has(a.action)) { seen.add(a.action); uniq.push(a); } });
    const order = { high: 0, mid: 1, low: 2 };
    uniq.sort((a, b) => order[a.priority] - order[b.priority]);
    return uniq.slice(0, 6);
  }

  function d_maxDrawdown(code) { return ETF_DETAIL[code].maxDrawdown; }

  // ---------- 对外: 单只评估 ----------
  function evaluate(code, mode, groupId) {
    const base = mode === "shortTerm" ? evalShortTerm(code) : evalLongTerm(code);
    const gradeKey = gradeFromScore(base.score, code);
    const g = RISK_GRADES[gradeKey];
    const ev = {
      code, name: QUOTE_DATA[code].name, fullCode: (ETF_META[code] || {}).fullCode || code,
      price: QUOTE_DATA[code].price, changePct: QUOTE_DATA[code].changePct,
      suspended: !!QUOTE_DATA[code].suspended,
      mode, score: Math.round(base.score),
      grade: gradeKey, gradeLabel: g.label, gradeAction: g.action, gradeColor: g.color, gradeBg: g.bg,
      signals: base.signals
    };
    ev.advices = buildAdvices(code, ev, mode, groupId);
    if (groupId === "holdings") ev.pnl = getHoldingPnl(code);
    return ev;
  }

  // ---------- 对外: 分组评估 ----------
  function evaluateGroup(groupId, mode) {
    const group = ETF_GROUPS[groupId];
    const items = group.codes.map(code => evaluate(code, mode, groupId));
    // 分组总评: 以风险最集中(深红优先) + 平均分的视角
    const gradeRank = { "deep-red": 0, "light-red": 1, yellow: 2, green: 3 };
    items.sort((a, b) => gradeRank[a.grade] - gradeRank[b.grade]);
    const avgScore = items.reduce((s, x) => s + x.score, 0) / items.length;
    const deepRed = items.filter(x => x.grade === "deep-red").length;
    const green = items.filter(x => x.grade === "green").length;
    let groupGrade;
    if (deepRed > 0) groupGrade = "deep-red";
    else if (avgScore >= 60) groupGrade = "green";
    else if (avgScore >= 48) groupGrade = "yellow";
    else groupGrade = "light-red";
    return { group, items, avgScore: Math.round(avgScore), groupGrade, deepRed, green, count: items.length };
  }

  return { evaluate, evaluateGroup, getHoldingPnl, RISK_GRADES, THRESHOLDS };
})();

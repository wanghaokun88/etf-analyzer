// ETF 分组风险分析仪表盘 - 主应用逻辑 v3.0

// ========== 全局状态 ==========
let currentMode = 'shortTerm';      // shortTerm | longTerm
let currentGroup = 'holdings';      // holdings | star | broad
let currentEtfCode = null;          // 弹层中的ETF
let currentEtfGroup = null;
let currentKlinePeriod = 'daily';
let chartInstances = {};

const KLINE_PERIOD_LABEL = { daily: '日线', weekly: '周线', monthly: '月线', min60: '60分', min30: '30分', min15: '15分', min5: '5分', min1: '1分' };

// 持仓成本价本地存储（不依赖交易平台，数据仅存浏览器）
const HOLDINGS_KEY = 'etf_holdings_v1';
// 占位示例（清除后回退到此）
const HOLDINGS_EXAMPLE = {
  sh513310: { cost: 1.214, shares: 10000 }, sh515880: { cost: 0.881, shares: 10000 },
  sh516510: { cost: 0.920, shares: 10000 }, sh588200: { cost: 0.925, shares: 10000 },
  sz159326: { cost: 0.878, shares: 10000 }, sz159516: { cost: 1.668, shares: 10000 },
  sz159732: { cost: 0.758, shares: 10000 }
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dataTime').textContent = DATA_TIMESTAMP;
  document.getElementById('dataSource').textContent = DATA_SOURCE;
  loadHoldingsFromStorage();
  updateHoldingsBtn();
  renderModeSwitch();
  renderGroupNav();
  renderGroup(currentGroup, currentMode);
  renderDataArchitecture();
});

// ========== 持仓管理(本地: 增删标的 / 加仓减仓 / 改成本) ==========
const DEFAULT_HOLDING_CODES = ETF_GROUPS.holdings.codes.slice();
let workingHoldings = null; // code -> {cost, shares} 编辑中工作副本

function loadHoldingsFromStorage() {
  try {
    const raw = localStorage.getItem(HOLDINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    const storedCodes = Array.isArray(data.codes)
      ? data.codes
      : Object.keys(data).filter(k => k !== 'version' && k !== 'configured');
    const items = data.items || (() => {
      const o = {};
      storedCodes.forEach(c => { if (data[c] && typeof data[c].cost === 'number') o[c] = data[c]; });
      return o;
    })();
    ETF_GROUPS.holdings.codes.length = 0;
    let any = false;
    storedCodes.forEach(c => {
      const it = items[c];
      if (QUOTE_DATA[c] && it && typeof it.cost === 'number' && typeof it.shares === 'number') {
        ETF_GROUPS.holdings.codes.push(c);
        MY_HOLDINGS[c] = { cost: it.cost, shares: it.shares };
        any = true;
      }
    });
    MY_HOLDINGS.configured = any;
  } catch (e) { /* 损坏的存储直接忽略 */ }
}

function ensureWorking() {
  if (workingHoldings) return;
  workingHoldings = {};
  ETF_GROUPS.holdings.codes.forEach(code => {
    const h = MY_HOLDINGS[code];
    if (h) workingHoldings[code] = { cost: h.cost, shares: h.shares };
  });
}

function heFlushInputs() {
  if (!workingHoldings) return;
  Object.keys(workingHoldings).forEach(code => {
    const cEl = document.getElementById('cost_' + code);
    const sEl = document.getElementById('shares_' + code);
    if (!cEl || !sEl) return;
    const c = parseFloat(cEl.value), s = parseFloat(sEl.value);
    if (cEl.value === '' && sEl.value === '') return; // 留空 = 不动
    if (!isNaN(c) && !isNaN(s) && c > 0 && s >= 0) workingHoldings[code] = { cost: +c.toFixed(3), shares: Math.round(s) };
  });
}

function heCommit(msg) {
  const codes = Object.keys(workingHoldings);
  ETF_GROUPS.holdings.codes.length = 0;
  codes.forEach(c => ETF_GROUPS.holdings.codes.push(c));
  Object.keys(MY_HOLDINGS).forEach(k => { if (k !== 'configured') delete MY_HOLDINGS[k]; });
  codes.forEach(c => { MY_HOLDINGS[c] = { cost: workingHoldings[c].cost, shares: workingHoldings[c].shares }; });
  MY_HOLDINGS.configured = codes.length > 0;
  const payload = { version: 1, codes, items: workingHoldings, configured: MY_HOLDINGS.configured };
  try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(payload)); } catch (e) {}
  updateHoldingsBtn();
  renderGroupNav();
  renderGroup(currentGroup, currentMode);
  if (msg) setHeMsg(msg, '#27ae60');
}

function setHeMsg(t, color) { const m = document.getElementById('heMsg'); if (m) { m.textContent = t; m.style.color = color || '#27ae60'; } }

function updateHoldingsBtn() {
  const b = document.getElementById('btnEditHoldings');
  if (!b) return;
  b.classList.toggle('configured', !!MY_HOLDINGS.configured);
  b.textContent = MY_HOLDINGS.configured ? '⚙️ 持仓管理·已配置' : '⚙️ 持仓管理';
}

function openHoldingsEditor() {
  ensureWorking();
  const box = document.getElementById('holdingsEditor');
  const held = Object.keys(workingHoldings);
  const pf = RiskEngine.getPortfolio();
  const rows = held.map(code => {
    const name = QUOTE_DATA[code].name, price = QUOTE_DATA[code].price;
    const h = workingHoldings[code];
    const pnlPct = (price - h.cost) / h.cost * 100;
    const cls = pnlPct >= 0 ? 'up' : 'down';
    const w = pf && pf.items[code] ? pf.items[code].weight : null;
    const wTxt = w != null ? w.toFixed(1) + '%' : '-';
    return `<tr>
      <td class="he-name">${name}<span class="he-code">${code}</span></td>
      <td class="he-price">${price}</td>
      <td class="he-pnl ${cls}">${fmtPct(pnlPct)}</td>
      <td class="he-weight">${wTxt}</td>
      <td><input type="number" class="he-input" id="cost_${code}" placeholder="买入价" step="0.001" min="0" value="${h.cost}"></td>
      <td><input type="number" class="he-input" id="shares_${code}" placeholder="份额" step="1" min="0" value="${h.shares}"></td>
      <td class="he-ops">
        <button class="he-mini he-add" onclick="heShowSub('${code}','add')">加仓</button>
        <button class="he-mini he-red" onclick="heShowSub('${code}','reduce')">减仓</button>
        <button class="he-mini he-del" onclick="heRemove('${code}')">移除</button>
      </td>
    </tr>
    <tr class="he-subrow" id="sub_${code}" style="display:none"><td colspan="7"></td></tr>`;
  }).join('');
  const avail = ALL_CODES.filter(c => !workingHoldings[c]);
  const opts = avail.length
    ? avail.map(c => `<option value="${c}">${QUOTE_DATA[c].name}（${c}）</option>`).join('')
    : '<option value="">无可用标的</option>';
  box.innerHTML = `
    <h2 style="margin:0 0 4px">持仓管理</h2>
    <p class="he-sub">数据仅保存在本浏览器（localStorage），不上传任何服务器。可增删标的、加仓 / 减仓、修改成本与份额。改成本 / 份额后点「保存全部」；加仓 / 减仓 / 移除 / 添加即时生效。</p>
    ${held.length ? `
    <table class="he-table">
      <thead><tr><th>ETF</th><th>现价</th><th>浮盈亏</th><th>仓位</th><th>成本价(元)</th><th>份额(份)</th><th>操作</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : `<p class="he-empty">当前无持仓。用下方「添加标的」加入你的 ETF。</p>`}
    <div class="he-add-panel">
      <div class="he-add-title">＋ 添加标的</div>
      <div class="he-add-row">
        <select id="addCode" class="he-input he-select">${opts}</select>
        <input type="number" id="addCost" class="he-input" placeholder="买入成本价" step="0.001" min="0">
        <input type="number" id="addShares" class="he-input" placeholder="持有份额" step="1" min="0">
        <button class="he-btn he-save" onclick="heAddHolding()">添加</button>
      </div>
    </div>
    <div class="he-actions">
      <button class="he-btn he-save" onclick="heSave()">保存全部</button>
      <button class="he-btn he-reset" onclick="heReset()">清除全部</button>
      <button class="he-btn he-cancel" onclick="closeHoldingsEditor()">关闭</button>
      <span id="heMsg" class="he-msg"></span>
    </div>`;
  document.getElementById('holdingsOverlay').classList.add('open');
}

function heShowSub(code, kind) {
  const sub = document.getElementById('sub_' + code);
  if (!sub) return;
  document.querySelectorAll('.he-subrow').forEach(r => { if (r.id !== 'sub_' + code) { r.style.display = 'none'; r.firstElementChild.innerHTML = ''; } });
  if (sub.style.display !== 'none') { sub.style.display = 'none'; sub.firstElementChild.innerHTML = ''; return; }
  if (kind === 'add') {
    sub.firstElementChild.innerHTML = `<div class="he-inline">
      <span>加仓·买入价</span><input type="number" id="addprice_${code}" class="he-input he-inline-input" step="0.001" min="0" placeholder="成交价">
      <span>买入份额</span><input type="number" id="addshares_${code}" class="he-input he-inline-input" step="1" min="1" placeholder="份额">
      <button class="he-mini he-add" onclick="heAddPos('${code}')">确认加仓</button>
      <button class="he-mini" onclick="heHideSub('${code}')">取消</button>
      <span id="adderr_${code}" class="he-msg"></span>
    </div>`;
  } else {
    sub.firstElementChild.innerHTML = `<div class="he-inline">
      <span>减仓·卖出份额</span><input type="number" id="sellshares_${code}" class="he-input he-inline-input" step="1" min="1" placeholder="份额">
      <span>成交价(可选)</span><input type="number" id="sellprice_${code}" class="he-input he-inline-input" step="0.001" min="0" placeholder="成交价">
      <button class="he-mini he-red" onclick="heReducePos('${code}')">确认减仓</button>
      <button class="he-mini" onclick="heHideSub('${code}')">取消</button>
      <span id="rederr_${code}" class="he-msg"></span>
    </div>`;
  }
  sub.style.display = '';
}

function heHideSub(code) {
  const sub = document.getElementById('sub_' + code);
  if (sub) { sub.style.display = 'none'; sub.firstElementChild.innerHTML = ''; }
}

function heAddPos(code) {
  heFlushInputs();
  const h = workingHoldings[code]; if (!h) return;
  const p = parseFloat(document.getElementById('addprice_' + code).value);
  const s = parseFloat(document.getElementById('addshares_' + code).value);
  const err = document.getElementById('adderr_' + code);
  if (isNaN(p) || isNaN(s) || p <= 0 || s <= 0) { if (err) { err.textContent = '请填写有效的买入价与份额'; err.style.color = '#e74c3c'; } return; }
  const addSh = Math.round(s);
  const newShares = h.shares + addSh;
  const newCost = (h.cost * h.shares + p * addSh) / newShares;
  workingHoldings[code] = { cost: +newCost.toFixed(3), shares: newShares };
  heCommit(`✅ ${QUOTE_DATA[code].name} 加仓 ${addSh} 份，新成本价 ${newCost.toFixed(3)}`);
  openHoldingsEditor();
}

function heReducePos(code) {
  heFlushInputs();
  const h = workingHoldings[code]; if (!h) return;
  const s = parseFloat(document.getElementById('sellshares_' + code).value);
  const err = document.getElementById('rederr_' + code);
  if (isNaN(s) || s <= 0) { if (err) { err.textContent = '请填写有效的卖出份额'; err.style.color = '#e74c3c'; } return; }
  const sell = Math.round(s);
  if (sell >= h.shares) {
    delete workingHoldings[code];
    heCommit(`✅ ${QUOTE_DATA[code].name} 已清仓并移除`);
  } else {
    workingHoldings[code] = { cost: h.cost, shares: h.shares - sell };
    heCommit(`✅ ${QUOTE_DATA[code].name} 减仓 ${sell} 份，剩 ${h.shares - sell} 份`);
  }
  openHoldingsEditor();
}

function heRemove(code) {
  delete workingHoldings[code];
  heCommit(`✅ 已移除 ${QUOTE_DATA[code].name}`);
  openHoldingsEditor();
}

function heAddHolding() {
  heFlushInputs();
  const sel = document.getElementById('addCode');
  const code = sel ? sel.value : '';
  const c = parseFloat(document.getElementById('addCost').value);
  const s = parseFloat(document.getElementById('addShares').value);
  if (!code || !QUOTE_DATA[code]) { setHeMsg('请选择要添加的标的', '#e74c3c'); return; }
  if (isNaN(c) || isNaN(s) || c <= 0 || s < 0) { setHeMsg('请填写有效的成本价与份额', '#e74c3c'); return; }
  workingHoldings[code] = { cost: +c.toFixed(3), shares: Math.round(s) };
  heCommit(`✅ 已添加 ${QUOTE_DATA[code].name}`);
  openHoldingsEditor();
}

function heSave() {
  heFlushInputs();
  const codes = Object.keys(workingHoldings);
  if (!codes.length) { setHeMsg('当前无持仓', '#e67e22'); return; }
  heCommit(`✅ 已保存 ${codes.length} 只（本浏览器）`);
  setTimeout(closeHoldingsEditor, 600);
}

function heReset() {
  try { localStorage.removeItem(HOLDINGS_KEY); } catch (e) {}
  workingHoldings = null;
  ETF_GROUPS.holdings.codes.length = 0;
  DEFAULT_HOLDING_CODES.forEach(c => {
    ETF_GROUPS.holdings.codes.push(c);
    if (HOLDINGS_EXAMPLE[c]) MY_HOLDINGS[c] = HOLDINGS_EXAMPLE[c];
  });
  MY_HOLDINGS.configured = false;
  updateHoldingsBtn();
  renderGroupNav();
  renderGroup(currentGroup, currentMode);
  closeHoldingsEditor();
}

function closeHoldingsEditor() { document.getElementById('holdingsOverlay').classList.remove('open'); }

// ========== 工具 ==========
function changeCls(p) { return p >= 0 ? 'up' : 'down'; }
function fmtPct(p, d = 2) { return (p >= 0 ? '+' : '') + p.toFixed(d) + '%'; }
function riskBadge(gradeKey) {
  const g = RISK_GRADES[gradeKey];
  return `<span class="risk-badge" style="color:${g.color};background:${g.bg};border:1px solid ${g.color}">${g.label}·${g.action}</span>`;
}
function ownerGroup(code) {
  if (ETF_GROUPS[currentGroup].codes.includes(code)) return currentGroup;
  for (const id in ETF_GROUPS) if (ETF_GROUPS[id].codes.includes(code)) return id;
  return 'holdings';
}
function getTech(code) { try { return TechnicalEngine.getTechnicalSignals(code); } catch (e) { return null; } }

// ========== 模式切换 ==========
function renderModeSwitch() {
  const box = document.getElementById('modeBtns');
  box.innerHTML = Object.values(ANALYSIS_MODES).map(m => `
    <button class="mode-btn ${m.key === currentMode ? 'active' : ''}" onclick="setMode('${m.key}')">${m.label}</button>
  `).join('');
  document.getElementById('modeDesc').textContent = ANALYSIS_MODES[currentMode].desc;
}
function setMode(mode) {
  currentMode = mode;
  renderModeSwitch();
  renderGroup(currentGroup, currentMode);
}

// ========== 分组导航 ==========
function renderGroupNav() {
  const nav = document.getElementById('groupNav');
  nav.innerHTML = Object.values(ETF_GROUPS).map(g => `
    <button class="group-nav-btn ${g.id === currentGroup ? 'active' : ''}" onclick="setGroup('${g.id}')">
      <span class="gn-icon">${g.icon}</span>
      <span class="gn-text"><b>${g.name}</b><i>${g.codes.length}只 · ${g.desc}</i></span>
    </button>
  `).join('');
}
function setGroup(gid) {
  currentGroup = gid;
  renderGroupNav();
  renderGroup(currentGroup, currentMode);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== 分组视图(核心: 表格 + 风险标签 + 建议) ==========
function renderGroup(groupId, mode) {
  const r = RiskEngine.evaluateGroup(groupId, mode);
  const g = r.group;
  const isHolding = groupId === 'holdings';
  const container = document.getElementById('groupView');
  let html = `<section class="group-section fade-in">`;

  // 分组头
  html += `<div class="group-header">
    <div class="gh-left">
      <span class="gh-icon">${g.icon}</span>
      <div>
        <div class="gh-title">${g.name} <span class="gh-count">${r.count}只</span></div>
        <div class="gh-desc">${g.desc}</div>
      </div>
    </div>
    <div class="gh-right">
      ${riskBadge(r.groupGrade)}
      <div class="gh-stats">
        <span>综合分 <b>${r.avgScore}</b></span>
        <span class="up">绿 ${r.green}</span>
        <span class="down">深红 ${r.deepRed}</span>
        <span>模式: <b>${ANALYSIS_MODES[mode].label}</b></span>
      </div>
    </div>
  </div>`;

  // 分组风险总评
  html += `<div class="group-risk-note" style="border-left:4px solid ${RISK_GRADES[r.groupGrade].color}">
    ${groupRiskNarrative(r, mode)}
  </div>`;

  // 持仓分组: 盈亏条
  if (isHolding) html += renderPnlStrip();

  // 分组表格
  html += renderGroupTable(r, mode);

  // 可落地操作建议(每条带数据逻辑)
  html += `<div class="section-title"><span class="section-icon">💡</span><h2>可落地操作建议（${ANALYSIS_MODES[mode].label} · 分标的）</h2></div>`;
  html += `<div class="advice-grid">`;
  r.items.forEach(it => { html += adviceCardHtml(it, mode); });
  html += `</div>`;

  // 数据维度明细(可折叠提示)
  html += `<div class="grp-data-note">数据维度：实时IOPV / 盘口五档 / 场内资金 / 两融 / 北向 / 指数估值PE·PB / 基金季报 / 规模数据 — 由自动化在交易日 09:31·11:31·13:31·16:00 刷新</div>`;

  html += `</section>`;
  container.innerHTML = html;
}

function groupRiskNarrative(r, mode) {
  const g = RISK_GRADES[r.groupGrade];
  const parts = [];
  if (r.deepRed > 0) parts.push(`本组 <b style="color:${g.color}">${r.deepRed}</b> 只处于「深红-立即减仓清仓」，风险集中释放`);
  if (r.green > 0) parts.push(`<b style="color:${RISK_GRADES.green.color}">${r.green}</b> 只处于「绿-机会加仓」`);
  if (mode === 'shortTerm') parts.push('短线以技术动能与资金流向为准');
  else parts.push('长线以估值分位与规模增长为准');
  parts.push(`综合分 ${r.avgScore}`);
  return `分组风险总评：<b style="color:${g.color}">${g.label}·${g.action}</b>。${parts.join('；')}。`;
}

function renderPnlStrip() {
  if (!MY_HOLDINGS.configured) {
    return `<div class="pnl-strip pnl-empty">⚠️ 持仓成本价未配置（当前为示例）。点击右上角 <b>「设置持仓成本」</b> 填入真实买入价与份额（数据存本浏览器），分组1 将立即显示真实盈亏 / 止损止盈 / 减仓提示。</div>`;
  }
  const pf = RiskEngine.getPortfolio();
  const cells = ETF_GROUPS.holdings.codes.map(code => {
    const pnl = RiskEngine.getHoldingPnl(code);
    if (!pnl) return '';
    const cls = pnl.profitPct >= 0 ? 'up' : 'down';
    const hit = pnl.profitPct <= THRESHOLDS.holding.stopLossPct ? 'hit-stop' : (pnl.profitPct >= THRESHOLDS.holding.takeProfitPct ? 'hit-tp' : '');
    const heavy = pnl.weight != null && pnl.weight > THRESHOLDS.holding.weightHeavy;
    return `<div class="pnl-cell ${hit} ${heavy ? 'heavy' : ''}">
      <div class="pnl-name">${QUOTE_DATA[code].name}${heavy ? '<span class="heavy-tag">仓位过重</span>' : ''}</div>
      <div class="pnl-pct ${cls}">${fmtPct(pnl.profitPct)}</div>
      <div class="pnl-line">市值 ¥${pnl.marketValue.toLocaleString()} · 仓位 ${pnl.weight != null ? pnl.weight.toFixed(1) : '—'}%</div>
      <div class="pnl-line">止损 ${pnl.stopLoss} / 止盈 ${pnl.takeProfit}</div>
    </div>`;
  }).join('');
  const total = pf ? pf.total.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
  return `<div class="pnl-strip"><div class="pnl-title">持仓盈亏 · 止损止盈 · 仓位（组合市值 ¥${total}）</div><div class="pnl-cells">${cells}</div></div>`;
}

function renderGroupTable(r, mode) {
  const headers = mode === 'shortTerm'
    ? ['ETF', '最新价', '涨跌幅', '风险', '主力净流入(亿)', 'RSI(14)', '综合分', '首要建议']
    : ['ETF', '最新价', '涨跌幅', '风险', 'PE分位', '规模增长', '综合分', '首要建议'];
  let html = `<div class="group-table-wrap"><table class="group-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  r.items.forEach(it => {
    const q = QUOTE_DATA[it.code];
    const f = FUND_FLOW[it.code];
    const tech = getTech(it.code);
    const v = VALUATION_DATA[it.code];
    const qd = QUARTERLY_DATA[it.code];
    const topAdv = it.advices[0];
    const cCls = changeCls(it.changePct);
    let colMid, colExtra;
    if (mode === 'shortTerm') {
      colMid = `<span class="${changeCls(f.mainNetInflow)}">${f.mainNetInflow.toFixed(2)}</span>`;
      colExtra = tech ? tech.rsiValue?.toFixed(0) : '—';
    } else {
      colMid = `<span class="${v.pePercentile <= 30 ? 'up' : v.pePercentile >= 70 ? 'down' : ''}">${v.pePercentile}%</span>`;
      colExtra = `${qd.aumChangePct >= 0 ? '+' : ''}${qd.aumChangePct}%`;
    }
    html += `<tr onclick="openDetail('${it.code}')" class="grp-row">
      <td class="gt-etf"><b>${it.name}</b><span class="gt-code">${it.fullCode}</span>${it.pnl && it.pnl.weight != null && it.pnl.weight > THRESHOLDS.holding.weightHeavy ? '<span class="heavy-badge">仓位过重</span>' : ''}</td>
      <td>${q.price.toFixed(3)}</td>
      <td class="${cCls}">${fmtPct(it.changePct)}</td>
      <td>${riskBadge(it.grade)}</td>
      <td>${colMid}</td>
      <td>${colExtra}</td>
      <td><span class="score-pill" style="background:${scoreColor(it.score)}">${it.score}</span></td>
      <td class="gt-adv">${topAdv ? `<span class="adv-tag prio-${topAdv.priority}">${topAdv.action}</span>` : '—'}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function adviceCardHtml(it, mode) {
  const advs = it.advices.map(a => `
    <li>
      <span class="adv-action prio-${a.priority}">${a.action}</span>
      <span class="adv-logic"><b>数据逻辑：</b>${a.logic}</span>
    </li>`).join('');
  return `<div class="advice-card" style="border-top:3px solid ${RISK_GRADES[it.grade].color}">
    <div class="advice-head">
      <span class="advice-name">${it.name}</span>
      ${riskBadge(it.grade)}
      <span class="advice-score">分 ${it.score}</span>
    </div>
    <ul class="advice-list">${advs}</ul>
    <button class="advice-detail-btn" onclick="openDetail('${it.code}')">查看技术/资金/估值明细 →</button>
  </div>`;
}

function scoreColor(score) {
  if (score >= 65) return '#27ae60';
  if (score >= 50) return '#f39c12';
  if (score >= 35) return '#e67e22';
  return '#c0392b';
}

// ========== 单只深度分析弹层 ==========
function openDetail(code) {
  currentEtfCode = code;
  currentEtfGroup = ownerGroup(code);
  currentKlinePeriod = 'daily';
  document.getElementById('detailOverlay').classList.add('open');
  renderEtfDetail(code);
}
function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};
}

function renderEtfDetail(code) {
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const ev = RiskEngine.evaluate(code, currentMode, currentEtfGroup);
  const q = QUOTE_DATA[code], d = ETF_DETAIL[code], f = FUND_FLOW[code];
  const es = ETF_SPECIFIC[code], iopv = IOPV_DATA[code], ob = ORDER_BOOK[code];
  const v = VALUATION_DATA[code], m = MARGIN_DATA[code], nb = NORTHBOUND_DATA[code], qd = QUARTERLY_DATA[code];
  const news = NEWS_DATA[code], meta = ETF_META[code], tech = getTech(code);
  const cCls = changeCls(q.changePct);
  const container = document.getElementById('etfDetail');

  let html = `<div class="fade-in">`;

  // 头部
  html += `<div class="detail-header">
    <div class="detail-info">
      <div class="detail-name">${q.name}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
        <span class="detail-code">${meta.fullCode}</span>
        <span class="detail-provider">${meta.provider}</span>
        ${q.suspended ? `<span style="color:#c0392b;font-size:12px;font-weight:600">⚠️ ${q.suspendInfo}</span>` : ''}
      </div>
    </div>
    <div class="detail-price-info">
      <div class="detail-price">${q.price.toFixed(3)}</div>
      <div class="detail-change ${cCls}">${fmtPct(q.changePct)}</div>
      <div class="detail-sub-info"><span>开 ${q.open.toFixed(3)}</span><span>高 ${q.high.toFixed(3)}</span><span>低 ${q.low.toFixed(3)}</span><span>昨收 ${q.preClose.toFixed(3)}</span></div>
    </div>
  </div>`;

  // 综合评分 + 风险等级
  html += `<div class="overall-score-card">
    <div class="overall-score-top">
      <div style="display:flex;align-items:center;gap:16px">
        <div class="score-circle" style="background:${scoreColor(ev.score)}">${ev.score}</div>
        <div>
          <div style="font-size:14px;color:var(--text-secondary)">综合评分（${ANALYSIS_MODES[currentMode].label}）</div>
          <div style="font-size:18px;font-weight:700;color:${RISK_GRADES[ev.grade].color}">${RISK_GRADES[ev.grade].label}·${RISK_GRADES[ev.grade].action}</div>
        </div>
      </div>
      <div class="trend-box">
        <div class="trend-item"><div class="trend-item-label">年内收益</div><div class="trend-item-value ${changeCls(d.yieldYtd)}">${fmtPct(d.yieldYtd)}</div></div>
        <div class="trend-item"><div class="trend-item-label">最大回撤</div><div class="trend-item-value down">${d.maxDrawdown.toFixed(1)}%</div></div>
        <div class="trend-item"><div class="trend-item-label">基金规模</div><div class="trend-item-value">${d.size.toFixed(1)}亿</div></div>
      </div>
    </div>
  </div>`;

  // 信号明细
  html += `<div class="section-title"><span class="section-icon">📡</span><h2>风险信号明细（${ANALYSIS_MODES[currentMode].label}）</h2></div>`;
  html += `<div class="signal-grid">` + ev.signals.map(s => `
    <div class="signal-item sig-${s.status}">
      <div class="signal-dim">${s.dim}</div>
      <div class="signal-val">${s.value}</div>
      <div class="signal-note">${s.note}</div>
    </div>`).join('') + `</div>`;

  // 持仓盈亏(分组1)
  if (currentEtfGroup === 'holdings') {
    const pnl = ev.pnl;
    if (pnl) {
      const pcls = pnl.profitPct >= 0 ? 'up' : 'down';
      const fee = (typeof FEE_RATE !== 'undefined' && FEE_RATE[code] != null) ? FEE_RATE[code] : null;
      const flagsHtml = (ev.holdingFlags && ev.holdingFlags.length) ? `<div class="hold-flags">${ev.holdingFlags.map(f => `<span class="hold-flag flag-${f.level}"><b>${f.label}</b>：${f.text}</span>`).join('')}</div>` : '';
      const sectorHtml = ev.sectorWeak ? `<div class="sector-switch">⚠️ 同赛道「${ev.sectorName}」中本标的性价比偏弱，建议切换至 <b>${ev.sectorBest}</b></div>` : '';
      html += `<div class="section-title"><span class="section-icon">💼</span><h2>持仓盈亏 / 止损止盈 / 仓位</h2></div>`;
      html += `<div class="pnl-detail">
        <div class="pnl-detail-item"><span>成本价</span><b>${pnl.cost}</b></div>
        <div class="pnl-detail-item"><span>现价</span><b>${q.price.toFixed(3)}</b></div>
        <div class="pnl-detail-item"><span>持仓</span><b>${pnl.shares.toLocaleString()}份</b></div>
        <div class="pnl-detail-item"><span>持仓市值</span><b>¥${pnl.marketValue.toLocaleString()}</b></div>
        <div class="pnl-detail-item"><span>占总仓位</span><b class="${pnl.weight != null && pnl.weight > THRESHOLDS.holding.weightHeavy ? 'down' : ''}">${pnl.weight != null ? pnl.weight.toFixed(1) : '—'}%</b></div>
        <div class="pnl-detail-item"><span>浮动盈亏</span><b class="${pcls}">${pnl.profit >= 0 ? '+' : ''}${pnl.profit.toFixed(0)}元 (${fmtPct(pnl.profitPct)})</b></div>
        <div class="pnl-detail-item"><span>止损线(${THRESHOLDS.holding.stopLossPct}%)</span><b class="down">${pnl.stopLoss}</b></div>
        <div class="pnl-detail-item"><span>止盈线(+${THRESHOLDS.holding.takeProfitPct}%)</span><b class="up">${pnl.takeProfit}</b></div>
        ${fee != null ? `<div class="pnl-detail-item"><span>年费率</span><b>${fee}%</b></div>` : ''}
      </div>${flagsHtml}${sectorHtml}`;
    }
  }

  // 盘口 + IOPV
  html += `<div class="section-title"><span class="section-icon">📊</span><h2>盘口五档 & IOPV（4时点快照）</h2></div>`;
  html += getRealtimePanelHtml(code);

  // 两融 / 北向 / 估值 / 季报
  html += `<div class="section-title"><span class="section-icon">🏦</span><h2>两融 / 北向 / 指数估值 / 基金季报</h2></div>`;
  html += `<div class="tech-detail-grid">
    <div class="tech-detail-item"><div class="tech-detail-label">融资余额</div><div class="tech-detail-value">${m.balance}亿</div><div class="tech-detail-signal ${m.change5d < 0 ? 'sell' : 'buy'}">5日 ${fmtPct(m.change5d)}</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">融券余量</div><div class="tech-detail-value">${m.lending}亿</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">北向净买(5日)</div><div class="tech-detail-value" style="color:${nb.netBuy5d >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${nb.netBuy5d >= 0 ? '+' : ''}${nb.netBuy5d}亿</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">北向持股占比</div><div class="tech-detail-value">${nb.hkHoldPct}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">指数PE(分位)</div><div class="tech-detail-value">${v.pe} (${v.pePercentile}%)</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">指数PB(分位)</div><div class="tech-detail-value">${v.pb} (${v.pbPercentile}%)</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">ROE</div><div class="tech-detail-value">${v.roe}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">季报规模增长</div><div class="tech-detail-value" style="color:${qd.aumChangePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${qd.aumChangePct >= 0 ? '+' : ''}${qd.aumChangePct}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">跟踪误差</div><div class="tech-detail-value">${qd.trackError}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">股息率</div><div class="tech-detail-value">${qd.dividendYield}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">份额变动</div><div class="tech-detail-value" style="color:${es.shareChangePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${es.shareChangePct >= 0 ? '+' : ''}${es.shareChangePct}%</div></div>
    <div class="tech-detail-item"><div class="tech-detail-label">跟踪指数</div><div class="tech-detail-value">${es.trackingIndex.name}</div></div>
  </div>`;

  // 多周期K线
  html += `<div class="section-title"><span class="section-icon">📉</span><h2>多周期K线（前复权）</h2></div>`;
  html += `<div class="kline-period-tabs" id="klinePeriodTabs">${['daily','weekly','monthly','min60','min30','min15','min5','min1'].map(p => `<button class="kline-period-btn ${p === currentKlinePeriod ? 'active' : ''}" onclick="switchKlinePeriod('${p}')">${KLINE_PERIOD_LABEL[p]}</button>`).join('')}</div>`;
  html += `<div class="chart-section"><div class="chart-container"><canvas id="klineChart"></canvas></div></div>`;

  // 技术指标
  html += `<div class="section-title"><span class="section-icon">🔧</span><h2>技术指标</h2></div>`;
  html += `<div class="chart-section"><div class="tech-chart-row">
    <div class="tech-chart-container"><canvas id="macdChart"></canvas></div>
    <div class="tech-chart-container"><canvas id="rsiChart"></canvas></div>
  </div><div class="tech-chart-row" style="margin-top:16px">
    <div class="tech-chart-container"><canvas id="kdjChart"></canvas></div>
    <div class="tech-chart-container"><canvas id="bollChart"></canvas></div>
  </div></div>`;

  // 资金流向
  html += `<div class="section-title"><span class="section-icon">💰</span><h2>资金流向</h2></div>`;
  html += `<div class="chart-section"><div class="fund-flow-chart"><canvas id="fundFlowChart"></canvas></div></div>`;

  // 消息面
  html += `<div class="section-title"><span class="section-icon">📰</span><h2>消息面</h2></div>`;
  html += `<div class="analysis-card"><ul class="news-list">${news.map(n => `<li class="news-item"><span class="news-date">${n.date}</span><span class="news-impact ${n.impact === '正面' ? 'positive' : n.impact === '负面' ? 'negative' : 'neutral'}">${n.impact}</span><div><span class="news-title">${n.title}</span><span class="news-source"> - ${n.source}</span></div></li>`).join('')}</ul></div>`;

  // 操作建议(带逻辑)
  html += `<div class="section-title"><span class="section-icon">💡</span><h2>操作建议（${ANALYSIS_MODES[currentMode].label}）</h2></div>`;
  html += `<div class="advice-list-full">` + ev.advices.map(a => `<li><span class="adv-action prio-${a.priority}">${a.action}</span><span class="adv-logic"><b>数据逻辑：</b>${a.logic}</span></li>`).join('') + `</div>`;

  html += `</div>`;
  container.innerHTML = html;

  requestAnimationFrame(() => {
    renderKlineChart(code); renderMacdChart(code); renderRsiChart(code);
    renderKdjChart(code); renderBollChart(code); renderFundFlowChart(code);
  });
}

// ========== 图表 ==========
function renderKlineChart(code, period = currentKlinePeriod) {
  const kline = KLINE_MULTI[code][period];
  const ma5 = TechnicalEngine.calculateMA(kline, 5);
  const ma10 = TechnicalEngine.calculateMA(kline, 10);
  const ma20 = TechnicalEngine.calculateMA(kline, 20);
  const ma60 = TechnicalEngine.calculateMA(kline, 60);
  const showDays = (['daily', 'weekly', 'monthly'].includes(period)) ? 60 : kline.length;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => (d.date ? d.date.slice(5) : (d.ts ? d.ts.slice(5) : '')));
  const closes = kline.slice(startIdx).map(d => d.close);
  const ctx = document.getElementById('klineChart'); if (!ctx) return;
  chartInstances.kline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: '收盘价', data: closes, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', borderWidth: 2, fill: true, pointRadius: 0, tension: 0.1 },
        { label: 'MA5', data: ma5.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
        { label: 'MA10', data: ma10.slice(startIdx), borderColor: '#9b59b6', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
        { label: 'MA20', data: ma20.slice(startIdx), borderColor: '#e74c3c', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
        { label: 'MA60', data: ma60.slice(startIdx), borderColor: '#1abc9c', borderWidth: 1.5, pointRadius: 0, tension: 0.1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 15 } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } }
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}
function renderMacdChart(code) {
  const kline = KLINE_DATA[code], macd = TechnicalEngine.calculateMACD(kline);
  const showDays = 60, startIdx = Math.max(0, kline.length - showDays), dates = kline.slice(startIdx).map(d => d.date.slice(5));
  const ctx = document.getElementById('macdChart'); if (!ctx) return;
  chartInstances.macd = new Chart(ctx, { type: 'bar', data: { labels: dates, datasets: [
    { label: 'MACD柱', data: macd.macd.slice(startIdx), backgroundColor: macd.macd.slice(startIdx).map(v => v >= 0 ? 'rgba(231,76,60,0.6)' : 'rgba(39,174,96,0.6)'), borderWidth: 0, barPercentage: 0.8, type: 'bar' },
    { label: 'DIF', data: macd.dif.slice(startIdx), borderColor: '#3498db', borderWidth: 1.5, pointRadius: 0, type: 'line', tension: 0.1 },
    { label: 'DEA', data: macd.dea.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, type: 'line', tension: 0.1 }
  ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } }, title: { display: true, text: 'MACD (12,26,9)', font: { size: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } } } } });
}
function renderRsiChart(code) {
  const kline = KLINE_DATA[code], rsi = TechnicalEngine.calculateRSI(kline);
  const showDays = 60, startIdx = Math.max(0, kline.length - showDays), dates = kline.slice(startIdx).map(d => d.date.slice(5));
  const ctx = document.getElementById('rsiChart'); if (!ctx) return;
  chartInstances.rsi = new Chart(ctx, { type: 'line', data: { labels: dates, datasets: [
    { label: 'RSI(14)', data: rsi.slice(startIdx), borderColor: '#9b59b6', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.1 },
    { label: '超买线(70)', data: dates.map(() => 70), borderColor: 'rgba(231,76,60,0.3)', borderWidth: 1, pointRadius: 0, borderDash: [5, 3], fill: false },
    { label: '超卖线(30)', data: dates.map(() => 30), borderColor: 'rgba(39,174,96,0.3)', borderWidth: 1, pointRadius: 0, borderDash: [5, 3], fill: false }
  ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } }, title: { display: true, text: 'RSI(14)', font: { size: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } }, y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } } } } });
}
function renderKdjChart(code) {
  const kline = KLINE_DATA[code], kdj = TechnicalEngine.calculateKDJ(kline);
  const showDays = 60, startIdx = Math.max(0, kline.length - showDays), dates = kline.slice(startIdx).map(d => d.date.slice(5));
  const ctx = document.getElementById('kdjChart'); if (!ctx) return;
  chartInstances.kdj = new Chart(ctx, { type: 'line', data: { labels: dates, datasets: [
    { label: 'K', data: kdj.k.slice(startIdx), borderColor: '#3498db', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
    { label: 'D', data: kdj.d.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
    { label: 'J', data: kdj.j.slice(startIdx), borderColor: '#e74c3c', borderWidth: 1.5, pointRadius: 0, tension: 0.1 }
  ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } }, title: { display: true, text: 'KDJ (9,3,3)', font: { size: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } }, y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } } } } });
}
function renderBollChart(code) {
  const kline = KLINE_DATA[code], boll = TechnicalEngine.calculateBollinger(kline);
  const showDays = 60, startIdx = Math.max(0, kline.length - showDays), dates = kline.slice(startIdx).map(d => d.date.slice(5)), closes = kline.slice(startIdx).map(d => d.close);
  const ctx = document.getElementById('bollChart'); if (!ctx) return;
  chartInstances.boll = new Chart(ctx, { type: 'line', data: { labels: dates, datasets: [
    { label: '上轨', data: boll.upper.slice(startIdx), borderColor: 'rgba(231,76,60,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
    { label: '中轨(MA20)', data: boll.middle.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, fill: false },
    { label: '下轨', data: boll.lower.slice(startIdx), borderColor: 'rgba(39,174,96,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
    { label: '收盘价', data: closes, borderColor: '#3498db', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.1 }
  ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } }, title: { display: true, text: '布林带 (20,2)', font: { size: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } } } } });
}
function renderFundFlowChart(code) {
  const f = FUND_FLOW[code]; const ctx = document.getElementById('fundFlowChart'); if (!ctx) return;
  chartInstances.fundFlow = new Chart(ctx, { type: 'bar', data: { labels: ['超大单', '大单', '中单', '小单', '主力净流入'], datasets: [{ label: '资金净额(亿)', data: [f.superLargeNet, f.largeNet, f.mediumNet, f.smallNet, f.mainNetInflow], backgroundColor: [f.superLargeNet, f.largeNet, f.mediumNet, f.smallNet, f.mainNetInflow].map(v => v >= 0 ? 'rgba(231,76,60,0.7)' : 'rgba(39,174,96,0.7)'), borderWidth: 0, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: `${QUOTE_DATA[code].name} - 资金流向 (亿元)`, font: { size: 12 } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } } } } });
}

function getRealtimePanelHtml(code) {
  const ob = ORDER_BOOK[code], iopv = IOPV_DATA[code], tick = TICK_DATA[code], q = QUOTE_DATA[code];
  let asksHtml = ob.asks.slice().reverse().map((a, i) => `<tr><td class="ob-level">卖${5 - i}</td><td class="ob-price down">${a.price.toFixed(3)}</td><td class="ob-vol">${a.vol.toLocaleString()}</td></tr>`).join('');
  let bidsHtml = ob.bids.map((b, i) => `<tr><td class="ob-level">买${i + 1}</td><td class="ob-price up">${b.price.toFixed(3)}</td><td class="ob-vol">${b.vol.toLocaleString()}</td></tr>`).join('');
  const arbCls = iopv.arbitrageSpace ? 'arb-yes' : 'arb-no';
  const arbText = iopv.arbitrageSpace ? '有套利空间' : '无套利空间';
  return `<div class="realtime-grid">
    <div class="realtime-card order-book-card">
      <div class="panel-title">📊 Level-1 五档盘口 <span class="realtime-badge">4时点快照</span></div>
      <table class="order-book-table"><thead><tr><th>档位</th><th>价格</th><th>挂单量</th></tr></thead>
        <tbody>${asksHtml}</tbody>
        <tbody><tr class="ob-now"><td>现价</td><td class="ob-price" style="font-weight:700">${q.price.toFixed(3)}</td><td class="ob-vol">${q.volume.toLocaleString()}</td></tr></tbody>
        <tbody>${bidsHtml}</tbody></table>
      <div class="ob-meta">量比 ${ob.volumeRatio} · 振幅 ${ob.amplitude}% · 换手 ${ob.turnoverRate}% · 外盘 ${ob.externalVol.toLocaleString()} / 内盘 ${ob.internalVol.toLocaleString()}</div>
    </div>
    <div class="realtime-card iopv-card">
      <div class="panel-title">💎 IOPV 实时净值 <span class="realtime-badge">4时点快照</span></div>
      <div class="iopv-main">
        <div class="iopv-row"><span>基金净值(IOPV)</span><b>${iopv.iopv.toFixed(4)}</b></div>
        <div class="iopv-row"><span>单位净值(NAV)</span><b>${iopv.nav.toFixed(4)}</b></div>
        <div class="iopv-row"><span>折溢价率</span><b style="color:${iopv.premiumRate >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${iopv.premiumRate >= 0 ? '+' : ''}${iopv.premiumRate}%</b></div>
        <div class="iopv-row"><span>偏离幅度</span><b>${iopv.premiumDeviation}%</b></div>
      </div>
      <div class="iopv-arb ${arbCls}">${arbText}${iopv.arbitrageSpace ? ` (|${iopv.premiumDeviation}|% > 0.5%)` : ''}</div>
    </div>
    <div class="realtime-card tick-card">
      <div class="panel-title">⚡ 分时逐笔成交 <span class="realtime-badge">4时点快照</span></div>
      <div class="tick-row"><span>主动买入</span><b class="up">${tick.activeBuy}亿</b></div>
      <div class="tick-row"><span>主动卖出</span><b class="down">${tick.activeSell}亿</b></div>
      <div class="tick-row"><span>主力净流入</span><b style="color:${tick.netInflow >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${tick.netInflow >= 0 ? '+' : ''}${tick.netInflow}亿</b></div>
      <div class="tick-row"><span>估算成交笔数</span><b>${tick.tradeCount.toLocaleString()}</b></div>
    </div>
  </div>`;
}

function switchKlinePeriod(period) {
  currentKlinePeriod = period;
  document.querySelectorAll('.kline-period-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.period === period));
  if (chartInstances.kline) { chartInstances.kline.destroy(); delete chartInstances.kline; }
  renderKlineChart(currentEtfCode, period);
}

// ========== 数据架构(折叠说明) ==========
function renderDataArchitecture() {
  const c = document.getElementById('dataArchitecture');
  const cats = [
    { n: '1. 实盘快照(4时点)', items: ['Level-1五档盘口', 'IOPV实时净值', '分时逐笔成交', '当日K线'] },
    { n: '2. 多周期历史K线', items: ['5/15/30/60分(前复权)', '日/周/月线(前复权)', 'OHLC+成交量+额'] },
    { n: '3. ETF专属基本面资金', items: ['两融(融资/融券)', '北向资金', '规模/份额变动', '跟踪误差/股息率'] },
    { n: '4. 指数估值 & 基金季报', items: ['PE/PB及历史分位', '基金季报(规模/持仓)', 'ROE', '宏观板块对照'] }
  ];
  let html = `<details><summary class="arch-summary">🗂️ 数据架构 v3.0 — 4大类数据 · 双模式 · 四级风险 · 固定阈值（点击展开）</summary>`;
  html += `<div class="arch-cat-grid">${cats.map(cat => `<div class="arch-cat-card"><div class="arch-cat-title">${cat.n}</div><ul>${cat.items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('')}</div>`;
  html += `<div class="arch-sched-title">4时点更新节奏（交易日自动刷新，非交易日跳过）</div><div class="arch-sched">`;
  UPDATE_SCHEDULE.forEach(s => {
    html += `<div class="arch-sched-card"><div class="arch-sched-head"><span class="arch-sched-cadence">${s.cadence}</span><span class="arch-sched-window">${s.window}</span></div><div class="arch-sched-freq">${s.freq}</div><div class="arch-sched-items"><b>采集项:</b> ${s.items.join('、')}</div><div class="arch-sched-method"><b>方式:</b> ${s.method}</div><div class="arch-sched-source"><b>数据源:</b> ${s.source}</div></div>`;
  });
  html += `</div></details>`;
  c.innerHTML = html;
}

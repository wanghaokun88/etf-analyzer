// ETF 多维度分析仪表盘 - 主应用逻辑

// ========== 全局状态 ==========
let currentEtfCode = 'sz159516'; // 默认选中年内涨幅最大的
let currentKlinePeriod = 'daily'; // 多周期K线当前周期
let chartInstances = {}; // Chart.js 实例管理

// 多周期K线标签
const KLINE_PERIOD_LABEL = {
  daily: '日线', weekly: '周线', monthly: '月线',
  min60: '60分', min30: '30分', min15: '15分', min5: '5分', min1: '1分'
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dataTime').textContent = DATA_TIMESTAMP;
  document.getElementById('dataSource').textContent = DATA_SOURCE;

  renderPortfolioOverview();
  renderTabBar();
  switchEtf(currentEtfCode);
  renderDataArchitecture();
});

// ========== 组合概览 ==========
function renderPortfolioOverview() {
  // 组合统计卡片
  const statsContainer = document.getElementById('portfolioStats');
  const totalChangePct = ETF_LIST.reduce((sum, etf) => sum + QUOTE_DATA[etf.code].changePct, 0) / ETF_LIST.length;
  const bestEtf = ETF_LIST.reduce((best, etf) => {
    const score = ANALYSIS_SUMMARY[etf.code].overallScore;
    return score > best.score ? { etf, score } : best;
  }, { etf: null, score: -1 });
  const worstEtf = ETF_LIST.reduce((worst, etf) => {
    const score = ANALYSIS_SUMMARY[etf.code].overallScore;
    return score < worst.score ? { etf, score } : worst;
  }, { etf: null, score: 101 });
  const totalMainFlow = ETF_LIST.reduce((sum, etf) => sum + FUND_FLOW[etf.code].mainNetInflow, 0);

  const stats = [
    { label: '组合平均涨跌', value: `${totalChangePct.toFixed(2)}%`, cls: totalChangePct >= 0 ? 'up' : 'down', sub: '7只ETF当日均值' },
    { label: '最优ETF', value: bestEtf.etf.name, cls: 'up', sub: `综合评分 ${bestEtf.score}` },
    { label: '最弱ETF', value: worstEtf.etf.name, cls: 'down', sub: `综合评分 ${worstEtf.score}` },
    { label: '主力资金净额', value: `${totalMainFlow.toFixed(2)}亿`, cls: totalMainFlow >= 0 ? 'up' : 'down', sub: '7只ETF合计' },
    { label: '组合风险等级', value: getRiskLevel(totalChangePct), cls: 'neutral', sub: '基于当日波动评估' },
  ];

  statsContainer.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value ${s.cls}">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>
  `).join('');

  // 持仓表格
  const tableContainer = document.getElementById('portfolioTable');
  const headers = ['ETF名称', '最新价', '涨跌幅', '成交量(万)', '规模(亿)', '年内涨幅', '主力净流(亿)', '综合评分', '短期趋势'];
  
  let tableHtml = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  
  ETF_LIST.forEach(etf => {
    const q = QUOTE_DATA[etf.code];
    const d = ETF_DETAIL[etf.code];
    const f = FUND_FLOW[etf.code];
    const a = ANALYSIS_SUMMARY[etf.code];
    const changeCls = q.changePct >= 0 ? 'up' : 'down';
    const ytdCls = d.yieldYtd >= 0 ? 'up' : 'down';
    const scoreColor = getScoreColor(a.overallScore);
    
    tableHtml += `<tr>
      <td>
        <div class="etf-name-cell">
          <span class="etf-name-badge" style="background:${getScoreBg(a.overallScore)};color:white">${etf.fullCode}</span>
          <span>${etf.name}</span>
        </div>
      </td>
      <td>${q.price.toFixed(3)}</td>
      <td><span class="change-pct ${changeCls}">${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%</span></td>
      <td>${(q.volume / 10000).toFixed(0)}</td>
      <td>${d.size.toFixed(2)}</td>
      <td><span class="change-pct ${ytdCls}">${d.yieldYtd >= 0 ? '+' : ''}${d.yieldYtd.toFixed(2)}%</span></td>
      <td><span style="color:${f.mainNetInflow >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${f.mainNetInflow.toFixed(2)}</span></td>
      <td>
        <div class="score-bar">
          <div class="score-bar-fill">
            <div class="score-bar-inner" style="width:${a.overallScore}%;background:${scoreColor}"></div>
          </div>
          <span class="score-bar-text" style="color:${scoreColor}">${a.overallScore}</span>
        </div>
      </td>
      <td>${a.shortTermTrend}</td>
    </tr>`;
  });
  
  tableHtml += '</tbody></table>';
  tableContainer.innerHTML = tableHtml;
}

function getRiskLevel(avgChange) {
  if (avgChange > -3) return '低';
  if (avgChange > -5) return '中';
  if (avgChange > -7) return '中偏高';
  return '高';
}

function getScoreColor(score) {
  if (score >= 70) return 'var(--color-up)';
  if (score >= 50) return 'var(--accent-yellow)';
  if (score >= 35) return 'var(--accent-orange)';
  return 'var(--color-down)';
}

function getScoreBg(score) {
  if (score >= 70) return '#e74c3c';
  if (score >= 50) return '#f39c12';
  if (score >= 35) return '#e67e22';
  return '#27ae60';
}

// ========== Tab Bar ==========
function renderTabBar() {
  const tabBar = document.getElementById('tabBar');
  tabBar.innerHTML = ETF_LIST.map(etf => {
    const q = QUOTE_DATA[etf.code];
    const changeCls = q.changePct >= 0 ? 'up' : 'down';
    const isActive = etf.code === currentEtfCode;
    return `<button class="tab-btn ${isActive ? 'active' : ''}" 
              data-code="${etf.code}"
              onclick="switchEtf('${etf.code}')">
      ${etf.name}
      <span class="tab-pct ${changeCls}">${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%</span>
    </button>`;
  }).join('');
}

function switchEtf(code) {
  currentEtfCode = code;
  // 更新Tab样式 - 使用 data-code 属性精确匹配
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.code === code;
    btn.classList.toggle('active', isActive);
  });
  renderEtfDetail(code);
}

// ========== ETF 详细分析渲染 ==========
function renderEtfDetail(code) {
  // 销毁旧图表
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const q = QUOTE_DATA[code];
  const d = ETF_DETAIL[code];
  const f = FUND_FLOW[code];
  const a = ANALYSIS_SUMMARY[code];
  const kline = KLINE_DATA[code];
  const news = NEWS_DATA[code];
  const etf = ETF_LIST.find(e => e.code === code);
  const techSignals = TechnicalEngine.getTechnicalSignals(code);

  const container = document.getElementById('etfDetail');
  const changeCls = q.changePct >= 0 ? 'up' : 'down';
  const scoreColor = getScoreColor(a.overallScore);
  const recCls = getRecommendationClass(a.overallScore);

  let html = `<div class="fade-in">`;

  // ===== 顶部信息 =====
  html += `<div class="detail-header">
    <div class="detail-info">
      <div>
        <div class="detail-name">${etf.name}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
          <span class="detail-code">${etf.fullCode}</span>
          <span class="detail-provider">${etf.provider}</span>
          ${d.status ? `<span style="color:var(--color-down);font-size:12px;font-weight:600">⚠️ ${d.status}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="detail-price-info">
      <div class="detail-price">${q.price.toFixed(3)}</div>
      <div>
        <div class="detail-change ${changeCls}">${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%</div>
        <div class="detail-sub-info">
          <span>开 ${q.open.toFixed(3)}</span>
          <span>高 ${q.high.toFixed(3)}</span>
          <span>低 ${q.low.toFixed(3)}</span>
          <span>昨收 ${q.preClose.toFixed(3)}</span>
        </div>
      </div>
    </div>
  </div>`;

  // ===== 综合评分 =====
  html += `<div class="overall-score-card">
    <div class="overall-score-top">
      <div style="display:flex;align-items:center;gap:16px">
        <div class="score-circle" style="background:${getScoreBg(a.overallScore)}">
          ${a.overallScore}
        </div>
        <div>
          <div style="font-size:14px;color:var(--text-secondary)">综合评分</div>
          <div style="font-size:18px;font-weight:700;color:${scoreColor}">${getVerdictLabel(a.overallScore)}</div>
          <div style="font-size:12px;color:var(--text-light)">风险等级: ${a.riskLevel}</div>
        </div>
      </div>
      <div class="trend-box">
        <div class="trend-item">
          <div class="trend-item-label">短期趋势 (1-2周)</div>
          <div class="trend-item-value" style="color:${getTrendColor(a.shortTermTrend)}">${a.shortTermTrend}</div>
          <div class="trend-item-confidence">置信度: ${a.shortTermConfidence}</div>
        </div>
        <div class="trend-item">
          <div class="trend-item-label">长期趋势 (1-3月)</div>
          <div class="trend-item-value" style="color:${getTrendColor(a.longTermTrend)}">${a.longTermTrend}</div>
          <div class="trend-item-confidence">置信度: ${a.longTermConfidence}</div>
        </div>
      </div>
    </div>
  </div>`;

  // ===== 实时盘口高频数据 (大类1) =====
  html += getRealtimePanelHtml(code);

  // ===== 五维评分 =====
  html += `<div class="section-title"><span class="section-icon">🎯</span><h2>五维评分体系</h2></div>`;
  html += `<div class="dimension-scores">`;
  const dims = [
    { key: 'fundamentals', label: '基本面', icon: '📋' },
    { key: 'technical', label: '技术面', icon: '📊' },
    { key: 'sentiment', label: '消息面', icon: '📰' },
    { key: 'moneyFlow', label: '资金面', icon: '💰' },
    { key: 'volume', label: '量能', icon: '📈' },
  ];
  dims.forEach(dim => {
    const data = a[dim.key];
    const cls = data.score >= 60 ? 'positive' : data.score >= 40 ? 'neutral' : 'negative';
    html += `<div class="dim-card">
      <div class="dim-card-label">${dim.icon} ${dim.label}</div>
      <div class="dim-card-score" style="color:${getScoreColor(data.score)}">${data.score}</div>
      <div class="dim-card-verdict ${cls}">${data.verdict}</div>
    </div>`;
  });
  html += `</div>`;

  // ===== 五维详情 =====
  html += `<div class="analysis-cards">`;
  dims.forEach(dim => {
    const data = a[dim.key];
    const badgeCls = data.score >= 60 ? 'positive' : data.score >= 40 ? 'neutral' : 'negative';
    html += `<div class="analysis-card">
      <div class="analysis-card-header">
        <div class="analysis-card-title"><span class="icon">${dim.icon}</span>${dim.label}分析</div>
        <div class="analysis-card-badge" style="background:${getScoreBg(data.score)};color:white">评分 ${data.score}</div>
      </div>
      <div class="analysis-card-content">${data.details}</div>
    </div>`;
  });
  html += `</div>`;

  // ===== 关键价位 =====
  html += `<div class="section-title"><span class="section-icon">⚡</span><h2>关键价位</h2></div>`;
  html += `<div class="key-levels">
    <div class="levels-grid">
      <div>
        <h4 style="color:var(--accent-teal);margin-bottom:12px">支撑位 (下行防线)</h4>
        <ul class="levels-list">
          ${a.supportLevels.map((p, i) => `<li><span class="levels-label">支撑${i+1} (${i === 0 ? '近期' : i === 1 ? '中期' : '远期'})</span><span class="levels-price support">${p.toFixed(3)}</span></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 style="color:var(--accent-orange);margin-bottom:12px">压力位 (上行阻力)</h4>
        <ul class="levels-list">
          ${a.pressureLevels.map((p, i) => `<li><span class="levels-label">压力${i+1} (${i === 0 ? '近期' : i === 1 ? '中期' : '远期'})</span><span class="levels-price pressure">${p.toFixed(3)}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  </div>`;

  // ===== 多周期K线 (大类2: 前复权) =====
  html += `<div class="section-title"><span class="section-icon">📉</span><h2>多周期K线 (前复权)</h2></div>`;
  html += `<div class="kline-period-tabs" id="klinePeriodTabs">
    ${['daily','weekly','monthly','min60','min30','min15','min5','min1'].map(p =>
      `<button class="kline-period-btn ${p === currentKlinePeriod ? 'active' : ''}" data-period="${p}" onclick="switchKlinePeriod('${p}')">${KLINE_PERIOD_LABEL[p]}</button>`
    ).join('')}
  </div>`;
  html += `<div class="chart-section">
    <div class="chart-container">
      <canvas id="klineChart"></canvas>
    </div>
  </div>`;

  // ===== 技术指标图表 =====
  html += `<div class="section-title"><span class="section-icon">🔧</span><h2>技术指标</h2></div>`;
  html += `<div class="chart-section">
    <div class="tech-chart-row">
      <div class="tech-chart-container"><canvas id="macdChart"></canvas></div>
      <div class="tech-chart-container"><canvas id="rsiChart"></canvas></div>
    </div>
    <div class="tech-chart-row" style="margin-top:16px">
      <div class="tech-chart-container"><canvas id="kdjChart"></canvas></div>
      <div class="tech-chart-container"><canvas id="bollChart"></canvas></div>
    </div>
  </div>`;

  // ===== 技术信号汇总 =====
  if (techSignals) {
    html += `<div class="section-title"><span class="section-icon">📡</span><h2>技术信号汇总</h2></div>`;
    html += `<div class="tech-detail-grid">`;
    const techItems = [
      { label: 'MACD信号', value: `${techSignals.macdCross}`, signal: techSignals.macdCross === '金叉' ? 'buy' : 'sell', detail: `DIF: ${techSignals.macdDif?.toFixed(4)} DEA: ${techSignals.macdDea?.toFixed(4)}` },
      { label: 'RSI(14)', value: `${techSignals.rsiValue?.toFixed(1)}`, signal: techSignals.rsiZone === '超卖' ? 'buy' : techSignals.rsiZone === '超买' ? 'sell' : 'neutral', detail: `区间: ${techSignals.rsiZone}` },
      { label: 'KDJ信号', value: `${techSignals.kdjCross}`, signal: techSignals.kdjCross === '金叉' ? 'buy' : 'sell', detail: `K:${techSignals.kdjK?.toFixed(1)} D:${techSignals.kdjD?.toFixed(1)} J:${techSignals.kdjJ?.toFixed(1)}` },
      { label: '均线排列', value: techSignals.maAlignment, signal: techSignals.maAlignment.includes('多头') ? 'buy' : techSignals.maAlignment.includes('空头') ? 'sell' : 'neutral', detail: `价格vsMA20: ${techSignals.priceVsMA20}` },
      { label: '布林位置', value: techSignals.bollPosition, signal: techSignals.bollPosition.includes('超卖') ? 'buy' : techSignals.bollPosition.includes('超买') ? 'sell' : 'neutral', detail: `带宽: ${techSignals.bollWidth ? (techSignals.bollWidth * 100).toFixed(1) + '%' : '-'}` },
      { label: '量能信号', value: `${techSignals.volTrend} (比率${techSignals.volRatio?.toFixed(2)})`, signal: techSignals.priceVolRelation.includes('量价齐升') ? 'buy' : techSignals.priceVolRelation.includes('放量下跌') ? 'sell' : 'neutral', detail: techSignals.priceVolRelation },
    ];
    techItems.forEach(item => {
      html += `<div class="tech-detail-item">
        <div class="tech-detail-label">${item.label}</div>
        <div class="tech-detail-value">${item.value}</div>
        <div class="tech-detail-signal ${item.signal}">${item.signal === 'buy' ? '偏多' : item.signal === 'sell' ? '偏空' : '中性'}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${item.detail}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // ===== 资金流向图表 =====
  html += `<div class="section-title"><span class="section-icon">💰</span><h2>资金流向</h2></div>`;
  html += `<div class="chart-section">
    <div class="fund-flow-chart">
      <canvas id="fundFlowChart"></canvas>
    </div>
  </div>`;

  // ===== ETF 详情 =====
  html += `<div class="section-title"><span class="section-icon">📋</span><h2>基本面详情</h2></div>`;
  html += `<div class="tech-detail-grid">
    <div class="tech-detail-item">
      <div class="tech-detail-label">基金规模</div>
      <div class="tech-detail-value">${d.size.toFixed(2)}亿</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">单位净值</div>
      <div class="tech-detail-value">${d.nav.toFixed(4)}</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">折溢价率</div>
      <div class="tech-detail-value" style="color:${d.premiumRate >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${d.premiumRate.toFixed(2)}%</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">年内收益率</div>
      <div class="tech-detail-value" style="color:${d.yieldYtd >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${d.yieldYtd >= 0 ? '+' : ''}${d.yieldYtd.toFixed(2)}%</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">最大回撤</div>
      <div class="tech-detail-value" style="color:var(--color-down)">${d.maxDrawdown.toFixed(1)}%</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">基金经理</div>
      <div class="tech-detail-value">${d.manager}</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">成立日期</div>
      <div class="tech-detail-value">${d.established}</div>
    </div>
    <div class="tech-detail-item">
      <div class="tech-detail-label">近1月收益</div>
      <div class="tech-detail-value" style="color:${d.yield1m >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${d.yield1m >= 0 ? '+' : ''}${d.yield1m.toFixed(2)}%</div>
    </div>
  </div>`;

  // 持仓Top10
  html += `<div style="margin-top:16px">
    <h4 style="margin-bottom:12px">前十大持仓</h4>
    <div class="holdings-grid">
      ${d.topHoldings.map(h => `<div class="holding-item">${h}</div>`).join('')}
    </div>
  </div>`;

  // ===== ETF专属基本面资金 (大类3) =====
  html += getEtfSpecificHtml(code);

  // ===== 宏观&板块对照 (大类4) =====
  html += getMacroSectorHtml(code);

  // ===== 消息面 =====
  html += `<div class="section-title"><span class="section-icon">📰</span><h2>消息面</h2></div>`;
  html += `<div class="analysis-card">
    <ul class="news-list">
      ${news.map(n => `<li class="news-item">
        <span class="news-date">${n.date}</span>
        <span class="news-impact ${n.impact === '正面' ? 'positive' : n.impact === '负面' ? 'negative' : 'neutral'}">${n.impact}</span>
        <div>
          <span class="news-title">${n.title}</span>
          <span class="news-source"> - ${n.source}</span>
        </div>
      </li>`).join('')}
    </ul>
  </div>`;

  // ===== 风险与机会 =====
  html += `<div class="section-title"><span class="section-icon">⚠️</span><h2>风险与机会</h2></div>`;
  html += `<div class="risk-opportunity-grid">
    <div>
      <div class="ro-section-title" style="color:var(--color-down)">⚠️ 主要风险</div>
      <ul class="ro-list risk">
        ${a.keyRisks.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    <div>
      <div class="ro-section-title" style="color:var(--color-up)">✅ 主要机会</div>
      <ul class="ro-list opportunity">
        ${a.keyOpportunities.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>
  </div>`;

  // ===== 投资建议 =====
  html += `<div class="section-title"><span class="section-icon">💡</span><h2>操作建议</h2></div>`;
  html += `<div class="recommendation-card ${recCls}">
    <div class="rec-label">${getRecommendationLabel(a.overallScore)}</div>
    <div class="rec-content">${a.recommendation}</div>
  </div>`;

  html += `</div>`;
  container.innerHTML = html;

  // 渲染图表（延迟确保DOM就绪）
  requestAnimationFrame(() => {
    renderKlineChart(code);
    renderMacdChart(code);
    renderRsiChart(code);
    renderKdjChart(code);
    renderBollChart(code);
    renderFundFlowChart(code);
  });
}

// ========== 图表渲染 ==========

function renderKlineChart(code, period = currentKlinePeriod) {
  const kline = KLINE_MULTI[code][period];
  const ma5 = TechnicalEngine.calculateMA(kline, 5);
  const ma10 = TechnicalEngine.calculateMA(kline, 10);
  const ma20 = TechnicalEngine.calculateMA(kline, 20);
  const ma60 = TechnicalEngine.calculateMA(kline, 60);

  // 展示数量: 日线/周线/月线取最近60, 分钟线取全部
  const showDays = (period === 'daily' || period === 'weekly' || period === 'monthly') ? 60 : kline.length;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => (d.date ? d.date.slice(5) : (d.ts ? d.ts.slice(5) : '')));
  const closes = kline.slice(startIdx).map(d => d.close);

  const ctx = document.getElementById('klineChart');
  if (!ctx) return;

  chartInstances.kline = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: '收盘价',
          data: closes,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52,152,219,0.1)',
          borderWidth: 2,
          fill: true,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'MA5',
          data: ma5.slice(startIdx),
          borderColor: '#f39c12',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'MA10',
          data: ma10.slice(startIdx),
          borderColor: '#9b59b6',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'MA20',
          data: ma20.slice(startIdx),
          borderColor: '#e74c3c',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'MA60',
          data: ma60.slice(startIdx),
          borderColor: '#1abc9c',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        }
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
  const kline = KLINE_DATA[code];
  const macd = TechnicalEngine.calculateMACD(kline);
  const showDays = 60;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => d.date.slice(5));

  const ctx = document.getElementById('macdChart');
  if (!ctx) return;

  chartInstances.macd = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'MACD柱',
          data: macd.macd.slice(startIdx),
          backgroundColor: macd.macd.slice(startIdx).map(v => v >= 0 ? 'rgba(231,76,60,0.6)' : 'rgba(39,174,96,0.6)'),
          borderWidth: 0,
          barPercentage: 0.8,
          type: 'bar'
        },
        {
          label: 'DIF',
          data: macd.dif.slice(startIdx),
          borderColor: '#3498db',
          borderWidth: 1.5,
          pointRadius: 0,
          type: 'line',
          tension: 0.1
        },
        {
          label: 'DEA',
          data: macd.dea.slice(startIdx),
          borderColor: '#f39c12',
          borderWidth: 1.5,
          pointRadius: 0,
          type: 'line',
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } },
        title: { display: true, text: 'MACD (12,26,9)', font: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderRsiChart(code) {
  const kline = KLINE_DATA[code];
  const rsi = TechnicalEngine.calculateRSI(kline);
  const showDays = 60;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => d.date.slice(5));

  const ctx = document.getElementById('rsiChart');
  if (!ctx) return;

  chartInstances.rsi = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'RSI(14)',
          data: rsi.slice(startIdx),
          borderColor: '#9b59b6',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1
        },
        {
          label: '超买线(70)',
          data: dates.map(() => 70),
          borderColor: 'rgba(231,76,60,0.3)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 3],
          fill: false
        },
        {
          label: '超卖线(30)',
          data: dates.map(() => 30),
          borderColor: 'rgba(39,174,96,0.3)',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 3],
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } },
        title: { display: true, text: 'RSI(14)', font: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderKdjChart(code) {
  const kline = KLINE_DATA[code];
  const kdj = TechnicalEngine.calculateKDJ(kline);
  const showDays = 60;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => d.date.slice(5));

  const ctx = document.getElementById('kdjChart');
  if (!ctx) return;

  chartInstances.kdj = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: 'K', data: kdj.k.slice(startIdx), borderColor: '#3498db', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
        { label: 'D', data: kdj.d.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, tension: 0.1 },
        { label: 'J', data: kdj.j.slice(startIdx), borderColor: '#e74c3c', borderWidth: 1.5, pointRadius: 0, tension: 0.1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } },
        title: { display: true, text: 'KDJ (9,3,3)', font: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderBollChart(code) {
  const kline = KLINE_DATA[code];
  const boll = TechnicalEngine.calculateBollinger(kline);
  const showDays = 60;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => d.date.slice(5));
  const closes = kline.slice(startIdx).map(d => d.close);

  const ctx = document.getElementById('bollChart');
  if (!ctx) return;

  chartInstances.boll = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        { label: '上轨', data: boll.upper.slice(startIdx), borderColor: 'rgba(231,76,60,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
        { label: '中轨(MA20)', data: boll.middle.slice(startIdx), borderColor: '#f39c12', borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: '下轨', data: boll.lower.slice(startIdx), borderColor: 'rgba(39,174,96,0.5)', borderWidth: 1, pointRadius: 0, fill: false },
        { label: '收盘价', data: closes, borderColor: '#3498db', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } },
        title: { display: true, text: '布林带 (20,2)', font: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderFundFlowChart(code) {
  const f = FUND_FLOW[code];
  const ctx = document.getElementById('fundFlowChart');
  if (!ctx) return;

  chartInstances.fundFlow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['超大单', '大单', '中单', '小单', '主力净流入'],
      datasets: [{
        label: '资金净额(亿)',
        data: [f.superLargeNet, f.largeNet, f.mediumNet, f.smallNet, f.mainNetInflow],
        backgroundColor: [f.superLargeNet, f.largeNet, f.mediumNet, f.smallNet, f.mainNetInflow].map(v => v >= 0 ? 'rgba(231,76,60,0.7)' : 'rgba(39,174,96,0.7)'),
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: `${QUOTE_DATA[code].name} - 资金流向 (单位:亿元)`, font: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ========== 大类数据面板渲染 ==========

// 大类1: 实时盘口高频
function getRealtimePanelHtml(code) {
  const ob = ORDER_BOOK[code];
  const iopv = IOPV_DATA[code];
  const tick = TICK_DATA[code];
  const q = QUOTE_DATA[code];

  let asksHtml = ob.asks.slice().reverse().map((a, i) => `
    <tr><td class="ob-level">卖${5 - i}</td><td class="ob-price down">${a.price.toFixed(3)}</td><td class="ob-vol">${a.vol.toLocaleString()}</td></tr>`).join('');
  let bidsHtml = ob.bids.map((b, i) => `
    <tr><td class="ob-level">买${i + 1}</td><td class="ob-price up">${b.price.toFixed(3)}</td><td class="ob-vol">${b.vol.toLocaleString()}</td></tr>`).join('');

  const arbCls = iopv.arbitrageSpace ? 'arb-yes' : 'arb-no';
  const arbText = iopv.arbitrageSpace ? '有套利空间' : '无套利空间';

  return `<div class="realtime-grid">
    <div class="realtime-card order-book-card">
      <div class="panel-title">📊 Level-1 五档盘口 <span class="realtime-badge">实时需后端源</span></div>
      <table class="order-book-table">
        <thead><tr><th>档位</th><th>价格</th><th>挂单量</th></tr></thead>
        <tbody>${asksHtml}</tbody>
        <tbody><tr class="ob-now"><td>现价</td><td class="ob-price" style="font-weight:700">${q.price.toFixed(3)}</td><td class="ob-vol">${q.volume.toLocaleString()}</td></tr></tbody>
        <tbody>${bidsHtml}</tbody>
      </table>
      <div class="ob-meta">量比 ${ob.volumeRatio} · 振幅 ${ob.amplitude}% · 换手 ${ob.turnoverRate}% · 外盘 ${ob.externalVol.toLocaleString()} / 内盘 ${ob.internalVol.toLocaleString()}</div>
    </div>
    <div class="realtime-card iopv-card">
      <div class="panel-title">💎 IOPV 实时净值 <span class="realtime-badge">实时需后端源</span></div>
      <div class="iopv-main">
        <div class="iopv-row"><span>基金净值(IOPV)</span><b>${iopv.iopv.toFixed(4)}</b></div>
        <div class="iopv-row"><span>单位净值(NAV)</span><b>${iopv.nav.toFixed(4)}</b></div>
        <div class="iopv-row"><span>折溢价率</span><b style="color:${iopv.premiumRate >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${iopv.premiumRate >= 0 ? '+' : ''}${iopv.premiumRate}%</b></div>
        <div class="iopv-row"><span>偏离幅度</span><b>${iopv.premiumDeviation}%</b></div>
      </div>
      <div class="iopv-arb ${arbCls}">${arbText}${iopv.arbitrageSpace ? ` (|${iopv.premiumDeviation}|% > 0.5%)` : ''}</div>
    </div>
    <div class="realtime-card tick-card">
      <div class="panel-title">⚡ 分时逐笔成交 <span class="realtime-badge">实时需后端源</span></div>
      <div class="tick-row"><span>主动买入</span><b class="up">${tick.activeBuy}亿</b></div>
      <div class="tick-row"><span>主动卖出</span><b class="down">${tick.activeSell}亿</b></div>
      <div class="tick-row"><span>主力净流入</span><b style="color:${tick.netInflow >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${tick.netInflow >= 0 ? '+' : ''}${tick.netInflow}亿</b></div>
      <div class="tick-row"><span>估算成交笔数</span><b>${tick.tradeCount.toLocaleString()}</b></div>
    </div>
  </div>`;
}

// 大类3: ETF专属基本面资金
function getEtfSpecificHtml(code) {
  const s = ETF_SPECIFIC[code];
  const pcfHtml = s.pcf.slice(0, 5).map(([name, w]) => `<div class="pcf-item"><span>${name}</span><span class="pcf-weight">${w}%</span></div>`).join('');
  return `<div class="section-title"><span class="section-icon">🏦</span><h2>ETF专属基本面 & 资金 (套利/规模指标)</h2></div>
  <div class="etf-specific-grid">
    <div class="es-card">
      <div class="es-label">总份额</div><div class="es-value">${s.totalShares}亿份</div>
      <div class="es-label">流通份额</div><div class="es-value">${s.circulationShares}亿份</div>
      <div class="es-label">份额变动</div><div class="es-value" style="color:${s.shareChangePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${s.shareChangePct >= 0 ? '+' : ''}${s.shareChangePct}%</div>
    </div>
    <div class="es-card">
      <div class="es-label">折溢价率</div><div class="es-value" style="color:${s.premiumRate >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${s.premiumRate >= 0 ? '+' : ''}${s.premiumRate}%</div>
      <div class="es-label">偏离幅度</div><div class="es-value">${s.premiumDeviation}%</div>
      <div class="es-label">融资余额</div><div class="es-value">${s.marginBalance}亿</div>
      <div class="es-label">融券余量</div><div class="es-value">${s.marginLending}亿</div>
    </div>
    <div class="es-card pcf-card">
      <div class="es-label" style="grid-column:1/-1">PCF申赎清单 (成分股权重 Top5)</div>
      ${pcfHtml}
    </div>
    <div class="es-card">
      <div class="es-label">跟踪标的指数</div><div class="es-value">${s.trackingIndex.name}</div>
      <div class="es-label">指数代码</div><div class="es-value">${s.trackingIndex.code}</div>
      <div class="es-label">指数涨跌</div><div class="es-value" style="color:${s.trackingIndex.changePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${s.trackingIndex.changePct >= 0 ? '+' : ''}${s.trackingIndex.changePct}%</div>
    </div>
  </div>`;
}

// 大类4: 宏观&板块对照
function getMacroSectorHtml(code) {
  const m = MACRO_SECTOR;
  const sec = m.sector[code];
  const b = m.benchmark;
  const senti = m.sentiment;
  const cat = m.macroCatalyst.map(c => `<li><span class="news-date">${c.date}</span><span class="news-impact ${c.impact === '正面' ? 'positive' : c.impact === '负面' ? 'negative' : 'neutral'}">${c.impact}</span><span class="news-title">${c.item}</span></li>`).join('');
  return `<div class="section-title"><span class="section-icon">🌐</span><h2>宏观 & 板块对照</h2></div>
  <div class="macro-grid">
    <div class="macro-card">
      <div class="panel-title">行业板块</div>
      <div class="tick-row"><span>${sec.name}</span><b style="color:${sec.changePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${sec.changePct >= 0 ? '+' : ''}${sec.changePct}%</b></div>
      <div class="tick-row"><span>板块成交额</span><b>${sec.turnover}亿</b></div>
      <div class="tick-row"><span>板块资金流</span><b style="color:${sec.fundFlow >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${sec.fundFlow >= 0 ? '+' : ''}${sec.fundFlow}亿</b></div>
    </div>
    <div class="macro-card">
      <div class="panel-title">宽基基准</div>
      ${Object.values(b).map(x => `<div class="tick-row"><span>${x.name}</span><b style="color:${x.changePct >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">${x.changePct >= 0 ? '+' : ''}${x.changePct}%</b></div>`).join('')}
    </div>
    <div class="macro-card">
      <div class="panel-title">大盘情绪</div>
      <div class="tick-row"><span>两市成交额</span><b>${senti.totalTurnover}亿</b></div>
      <div class="tick-row"><span>涨跌家数</span><b><span class="up">${senti.upCount}</span> / <span class="down">${senti.downCount}</span></b></div>
      <div class="tick-row"><span>涨跌停</span><b>↑${senti.limitUp} ↓${senti.limitDown}</b></div>
    </div>
    <div class="macro-card catalyst-card">
      <div class="panel-title">行业宏观催化</div>
      <ul class="news-list" style="padding:0">${cat}</ul>
    </div>
  </div>`;
}

// 多周期K线切换
function switchKlinePeriod(period) {
  currentKlinePeriod = period;
  document.querySelectorAll('.kline-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  if (chartInstances.kline) { chartInstances.kline.destroy(); delete chartInstances.kline; }
  renderKlineChart(currentEtfCode, period);
}

// 数据架构 & 更新节奏 (全局)
function renderDataArchitecture() {
  const container = document.getElementById('dataArchitecture');
  if (!container) return;
  const cats = [
    { n: '1. 实时盘口高频', items: ['Level-1五档盘口', 'IOPV实时净值', '分时逐笔成交', '1分钟K线快照'] },
    { n: '2. 多周期历史K线', items: ['5/15/30/60分钟(前复权)', '日/周/月线(前复权)', 'OHLC+成交量+额', '回测/训练基底'] },
    { n: '3. ETF专属基本面资金', items: ['总/流通份额', 'PCF申赎清单', '折溢价率/偏离', '融资余额/融券余量', '跟踪指数行情'] },
    { n: '4. 宏观&板块对照', items: ['行业板块涨跌/资金流', '宽基基准', '大盘情绪指标', '行业宏观催化'] }
  ];
  let html = `<div class="section-title"><span class="section-icon">🗂️</span><h2>数据架构 v2.0 — 4大类数据 + 5档更新节奏</h2></div>`;
  html += `<div class="arch-cat-grid">${cats.map(c => `<div class="arch-cat-card"><div class="arch-cat-title">${c.n}</div><ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('')}</div>`;
  html += `<div class="arch-sched-title">5档更新节奏</div><div class="arch-sched">`;
  UPDATE_SCHEDULE.forEach(s => {
    html += `<div class="arch-sched-card">
      <div class="arch-sched-head"><span class="arch-sched-cadence">${s.cadence}</span><span class="arch-sched-window">${s.window}</span></div>
      <div class="arch-sched-freq">${s.freq}</div>
      <div class="arch-sched-items"><b>采集项:</b> ${s.items.join('、')}</div>
      <div class="arch-sched-method"><b>方式:</b> ${s.method}</div>
      <div class="arch-sched-source"><b>数据源:</b> ${s.source}</div>
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ========== 工具函数 ==========

function getVerdictLabel(score) {
  if (score >= 75) return '强烈看多';
  if (score >= 60) return '偏多';
  if (score >= 50) return '中性偏多';
  if (score >= 40) return '中性';
  if (score >= 30) return '偏空';
  return '强烈看空';
}

function getTrendColor(trend) {
  if (trend.includes('看涨') || trend.includes('偏多') || trend.includes('多')) return 'var(--color-up)';
  if (trend.includes('看跌') || trend.includes('偏空') || trend.includes('空')) return 'var(--color-down)';
  return 'var(--accent-yellow)';
}

function getRecommendationClass(score) {
  if (score >= 70) return 'buy';
  if (score >= 50) return 'hold';
  if (score >= 35) return 'watch';
  return 'sell';
}

function getRecommendationLabel(score) {
  if (score >= 70) return '建议：逢低加仓';
  if (score >= 50) return '建议：持有观望';
  if (score >= 35) return '建议：谨慎观望';
  return '建议：减仓避险';
}

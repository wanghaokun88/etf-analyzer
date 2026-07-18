// ETF 多维度分析仪表盘 - 主应用逻辑

// ========== 全局状态 ==========
let currentEtfCode = 'sz159516'; // 默认选中年内涨幅最大的
let chartInstances = {}; // Chart.js 实例管理

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dataTime').textContent = DATA_TIMESTAMP;
  document.getElementById('dataSource').textContent = DATA_SOURCE;

  renderPortfolioOverview();
  renderTabBar();
  switchEtf(currentEtfCode);
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

  // ===== K线图表 =====
  html += `<div class="section-title"><span class="section-icon">📉</span><h2>K线走势与均线</h2></div>`;
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

function renderKlineChart(code) {
  const kline = KLINE_DATA[code];
  const ma5 = TechnicalEngine.calculateMA(kline, 5);
  const ma10 = TechnicalEngine.calculateMA(kline, 10);
  const ma20 = TechnicalEngine.calculateMA(kline, 20);
  const ma60 = TechnicalEngine.calculateMA(kline, 60);

  // 只展示最近60天
  const showDays = 60;
  const startIdx = Math.max(0, kline.length - showDays);
  const dates = kline.slice(startIdx).map(d => d.date.slice(5)); // MM-DD格式
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

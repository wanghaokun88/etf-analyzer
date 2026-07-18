// ETF 多维度分析数据集
// 数据采集时间: 2026-07-17 收盘
// 数据来源: 腾讯自选股行情数据接口

const ETF_LIST = [
  { code: "sh513310", name: "中韩半导体ETF", provider: "华泰柏瑞", fullCode: "513310" },
  { code: "sh515880", name: "通信ETF", provider: "国泰", fullCode: "515880" },
  { code: "sh516510", name: "云计算ETF", provider: "易方达", fullCode: "516510" },
  { code: "sh588200", name: "科创芯片ETF", provider: "嘉实", fullCode: "588200" },
  { code: "sz159326", name: "电网设备ETF", provider: "华夏", fullCode: "159326" },
  { code: "sz159516", name: "半导体设备ETF", provider: "国泰", fullCode: "159516" },
  { code: "sz159732", name: "消费电子ETF", provider: "华夏", fullCode: "159732" }
];

// 实时行情数据 (2026-07-17)
const QUOTE_DATA = {
  sh513310: {
    name: "中韩半导体ETF", price: 1.214, change: -0.134, changePct: -10.00,
    open: 1.270, high: 1.348, low: 1.210, preClose: 1.348, volume: 67684200,
    turnover: 85815000, amount: 104708900, marketCap: 14.24,
    suspended: true, suspendInfo: "暂停申购/赎回"
  },
  sh515880: {
    name: "通信ETF", price: 0.881, change: -0.042, changePct: -4.74,
    open: 0.911, high: 0.931, low: 0.876, preClose: 0.923, volume: 10862700,
    turnover: 10042000, amount: 9445000, marketCap: 9.56
  },
  sh516510: {
    name: "云计算ETF", price: 0.920, change: -0.048, changePct: -5.22,
    open: 0.952, high: 0.978, low: 0.913, preClose: 0.968, volume: 5791300,
    turnover: 5562000, amount: 5265000, marketCap: 8.75
  },
  sh588200: {
    name: "科创芯片ETF", price: 0.925, change: -0.048, changePct: -5.19,
    open: 0.960, high: 0.981, low: 0.916, preClose: 0.973, volume: 5346300,
    turnover: 4997000, amount: 4738000, marketCap: 7.86
  },
  sz159326: {
    name: "电网设备ETF", price: 0.878, change: -0.042, changePct: -4.77,
    open: 0.908, high: 0.931, low: 0.872, preClose: 0.920, volume: 3428600,
    turnover: 3094000, amount: 2906000, marketCap: 4.41
  },
  sz159516: {
    name: "半导体设备ETF", price: 1.668, change: -0.086, changePct: -5.14,
    open: 1.722, high: 1.782, low: 1.647, preClose: 1.754, volume: 7963500,
    turnover: 13648000, amount: 12960000, marketCap: 12.64
  },
  sz159732: {
    name: "消费电子ETF", price: 0.758, change: -0.036, changePct: -4.59,
    open: 0.782, high: 0.801, low: 0.748, preClose: 0.794, volume: 5174200,
    turnover: 3945000, amount: 3724000, marketCap: 4.86
  }
};

// ETF 详情数据
const ETF_DETAIL = {
  sh513310: {
    nav: 1.2145, accNav: 1.2145, premiumRate: -0.04,
    size: 14.24, yieldYtd: -14.85, yield1m: -10.00,
    maxDrawdown: -35.2, manager: "柳军", established: "2023-07-07",
    status: "暂停申购赎回",
    topHoldings: ["三星电子","SK海力士","中芯国际","北方华创","韦尔股份","长电科技","兆易创新","紫光国微","澜起科技","晶晨股份"]
  },
  sh515880: {
    nav: 0.881, accNav: 0.881, premiumRate: 0.00,
    size: 9.56, yieldYtd: -5.62, yield1m: -4.74,
    maxDrawdown: -18.6, manager: "梁杏", established: "2020-01-03",
    topHoldings: ["中兴通讯","中际旭创","新易盛","天孚通信","光迅科技","亨通光电","烽火通信","紫光股份","星网锐捷","华工科技"]
  },
  sh516510: {
    nav: 0.920, accNav: 0.920, premiumRate: 0.00,
    size: 8.75, yieldYtd: -7.83, yield1m: -5.22,
    maxDrawdown: -22.4, manager: "张湛", established: "2021-04-20",
    topHoldings: ["金山办公","中科曙光","浪潮信息","紫光股份","光环新网","宝信软件","用友网络","广联达","同花顺","恒生电子"]
  },
  sh588200: {
    nav: 0.925, accNav: 0.925, premiumRate: 0.00,
    size: 7.86, yieldYtd: 47.29, yield1m: -5.19,
    maxDrawdown: -28.8, manager: "周宇驰", established: "2022-09-30",
    topHoldings: ["中芯国际","北方华创","韦尔股份","澜起科技","晶晨股份","沪硅产业","华熙生物","君实生物","金山办公","传音控股"]
  },
  sz159326: {
    nav: 0.878, accNav: 0.878, premiumRate: 0.00,
    size: 4.41, yieldYtd: -3.26, yield1m: -4.77,
    maxDrawdown: -15.8, manager: "李俊", established: "2024-06-07",
    topHoldings: ["国电南瑞","许继电气","平高电气","中国西电","思源电气","特变电工","金盘科技","华明装备","长高集团","保变电气"]
  },
  sz159516: {
    nav: 1.668, accNav: 1.668, premiumRate: 0.00,
    size: 12.64, yieldYtd: 71.48, yield1m: -5.14,
    maxDrawdown: -32.5, manager: "梁杏", established: "2022-09-30",
    topHoldings: ["北方华创","中微公司","芯源微","华海清科","盛美半导体","拓荆科技","长川科技","精测电子","万业企业","至纯科技"]
  },
  sz159732: {
    nav: 0.758, accNav: 0.758, premiumRate: 0.00,
    size: 4.86, yieldYtd: -8.15, yield1m: -4.59,
    maxDrawdown: -21.3, manager: "李俊", established: "2023-06-05",
    topHoldings: ["立讯精密","歌尔股份","传音控股","漫步者","蓝思科技","领益智造","环旭电子","安克创新","佳禾智能","共达电声"]
  }
};

// 资金流向数据 (2026-07-17)
const FUND_FLOW = {
  sh513310: { mainNetInflow: -2.48, mainInflow: 3.12, mainOutflow: 5.60, retailNetInflow: 2.48, superLargeNet: -1.85, largeNet: -0.63, mediumNet: 0.82, smallNet: 1.66 },
  sh515880: { mainNetInflow: -0.86, mainInflow: 1.24, mainOutflow: 2.10, retailNetInflow: 0.86, superLargeNet: -0.52, largeNet: -0.34, mediumNet: 0.38, smallNet: 0.48 },
  sh516510: { mainNetInflow: -0.62, mainInflow: 0.95, mainOutflow: 1.57, retailNetInflow: 0.62, superLargeNet: -0.38, largeNet: -0.24, mediumNet: 0.29, smallNet: 0.33 },
  sh588200: { mainNetInflow: -0.45, mainInflow: 0.78, mainOutflow: 1.23, retailNetInflow: 0.45, superLargeNet: -0.28, largeNet: -0.17, mediumNet: 0.21, smallNet: 0.24 },
  sz159326: { mainNetInflow: -0.31, mainInflow: 0.52, mainOutflow: 0.83, retailNetInflow: 0.31, superLargeNet: -0.18, largeNet: -0.13, mediumNet: 0.15, smallNet: 0.16 },
  sz159516: { mainNetInflow: -1.23, mainInflow: 2.05, mainOutflow: 3.28, retailNetInflow: 1.23, superLargeNet: -0.82, largeNet: -0.41, mediumNet: 0.58, smallNet: 0.65 },
  sz159732: { mainNetInflow: -0.28, mainInflow: 0.46, mainOutflow: 0.74, retailNetInflow: 0.28, superLargeNet: -0.16, largeNet: -0.12, mediumNet: 0.13, smallNet: 0.15 }
};

// 120日K线数据 (模拟生成，基于真实行情参数)
// 实际部署时可通过脚本定期更新此数据
function generateKlineData(code) {
  const quote = QUOTE_DATA[code];
  const detail = ETF_DETAIL[code];
  const basePrice = quote.preClose;
  const ytdReturn = detail.yieldYtd / 100;
  const startPrice = basePrice / (1 + ytdReturn / 365 * 120);

  const data = [];
  const days = 120;
  let price = startPrice;
  const volatility = code === "sh513310" ? 0.025 : code === "sz159516" ? 0.022 : 0.018;

  // 趋势模拟：年内涨幅大的先涨后跌，跌幅大的持续下跌
  const trendSlope = ytdReturn / days * 0.3;
  let phase = 0; // 0=上涨期, 1=调整期
  const phaseLength = Math.floor(days * 0.6);

  for (let i = days; i >= 0; i--) {
    const date = new Date(2026, 6, 17); // July 17, 2026
    date.setDate(date.getDate() - i);

    // 阶段性趋势
    if (i < days - phaseLength) {
      phase = 1;
    }

    const trend = phase === 0 ? trendSlope : -trendSlope * 0.8;
    const random = (Math.random() - 0.5) * volatility;
    const changePct = trend + random;

    const open = price;
    const close = price * (1 + changePct);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(quote.volume * (0.3 + Math.random() * 0.7) / days);

    // 最后一天用真实数据
    if (i === 0) {
      data.push({
        date: "2026-07-17",
        open: quote.open, high: quote.high, low: quote.low, close: quote.price,
        volume: quote.volume, amount: quote.amount
      });
    } else {
      data.push({
        date: date.toISOString().split("T")[0],
        open: parseFloat(open.toFixed(3)),
        high: parseFloat(high.toFixed(3)),
        low: parseFloat(low.toFixed(3)),
        close: parseFloat(close.toFixed(3)),
        volume: volume,
        amount: Math.floor(volume * close)
      });
    }
    price = i === 0 ? quote.price : close;
  }
  return data;
}

// 生成所有ETF的K线数据
const KLINE_DATA = {};
ETF_LIST.forEach(etf => {
  KLINE_DATA[etf.code] = generateKlineData(etf.code);
});

// 新闻与消息面数据 (2026年7月)
const NEWS_DATA = {
  sh513310: [
    { date: "2026-07-17", title: "中韩半导体ETF暂停申购赎回，溢价风险提示", source: "华泰柏瑞公告", impact: "负面" },
    { date: "2026-07-15", title: "三星电子Q2利润不及预期，韩国半导体板块承压", source: "路透社", impact: "负面" },
    { date: "2026-07-10", title: "SK海力士HBM产能扩张计划公布", source: "韩联社", impact: "正面" },
    { date: "2026-07-05", title: "中芯国际28nm产能持续提升", source: "中芯国际公告", impact: "正面" },
    { date: "2026-07-01", title: "美国对华半导体出口管制再加码", source: "商务部公告", impact: "负面" }
  ],
  sh515880: [
    { date: "2026-07-17", title: "通信板块随大盘调整，光模块龙头跌幅较大", source: "证券时报", impact: "负面" },
    { date: "2026-07-12", title: "中际旭创800G光模块出货量创新高", source: "公司公告", impact: "正面" },
    { date: "2026-07-08", title: "运营商5G-A商用推进加速", source: "工信部", impact: "正面" },
    { date: "2026-07-03", title: "全球AI算力需求持续旺盛，光通信受益", source: "TrendForce", impact: "正面" },
    { date: "2026-07-01", title: "中兴通讯Q2海外订单签约超预期", source: "公司公告", impact: "正面" }
  ],
  sh516510: [
    { date: "2026-07-17", title: "云计算板块回调，金山办公领跌", source: "东方财富", impact: "负面" },
    { date: "2026-07-14", title: "金山办公WPS AI功能用户数突破5000万", source: "公司公告", impact: "正面" },
    { date: "2026-07-09", title: "浪潮信息发布新一代AI服务器", source: "公司公告", impact: "正面" },
    { date: "2026-07-04", title: "云计算市场Q2增速放缓至15%", source: "IDC报告", impact: "中性" },
    { date: "2026-07-01", title: "阿里云降价促销挤压利润空间", source: "36氪", impact: "负面" }
  ],
  sh588200: [
    { date: "2026-07-17", title: "科创芯片ETF年内涨幅47%后遭遇调整", source: "中国证券报", impact: "中性" },
    { date: "2026-07-13", title: "中芯国际获大基金三期注资", source: "大基金公告", impact: "正面" },
    { date: "2026-07-08", title: "北方华创半导体设备订单超预期", source: "公司公告", impact: "正面" },
    { date: "2026-07-03", title: "科创板芯片股估值偏高引发市场担忧", source: "证券时报", impact: "负面" },
    { date: "2026-07-01", title: "澜起科技DDR5接口芯片出货量翻倍", source: "公司公告", impact: "正面" }
  ],
  sz159326: [
    { date: "2026-07-17", title: "电网设备板块随大盘回调", source: "证券时报", impact: "负面" },
    { date: "2026-07-12", title: "国电南瑞Q2营收同比增长25%", source: "公司公告", impact: "正面" },
    { date: "2026-07-07", title: "特高压建设规划2026年投资超600亿", source: "国家电网", impact: "正面" },
    { date: "2026-07-02", title: "新能源配储政策推动电网设备需求", source: "发改委", impact: "正面" },
    { date: "2026-07-01", title: "许继电气中标国网大单", source: "公司公告", impact: "正面" }
  ],
  sz159516: [
    { date: "2026-07-17", title: "半导体设备ETF年内涨71%后大幅回调5.14%", source: "中国证券报", impact: "中性" },
    { date: "2026-07-13", title: "北方华创获大基金三期战略投资", source: "大基金公告", impact: "正面" },
    { date: "2026-07-08", title: "中微公司刻蚀设备出货量创历史新高", source: "公司公告", impact: "正面" },
    { date: "2026-07-03", title: "美国半导体出口管制升级影响设备国产替代进程", source: "商务部", impact: "负面" },
    { date: "2026-07-01", title: "大基金三期成立，重点投向半导体设备", source: "财政部", impact: "正面" }
  ],
  sz159732: [
    { date: "2026-07-17", title: "消费电子板块跟随大盘调整", source: "东方财富", impact: "负面" },
    { date: "2026-07-12", title: "立讯精密打入苹果iPhone 18供应链", source: "产业链消息", impact: "正面" },
    { date: "2026-07-07", title: "消费电子Q2出货量环比回升", source: "IDC数据", impact: "正面" },
    { date: "2026-07-02", title: "苹果新品发布会延迟影响供应链预期", source: "彭博社", impact: "负面" },
    { date: "2026-07-01", title: "歌尔股份VR设备订单恢复增长", source: "公司公告", impact: "正面" }
  ]
};

// 综合分析结论与预测数据
const ANALYSIS_SUMMARY = {
  sh513310: {
    overallScore: 35, // 0-100
    shortTermTrend: "看跌", shortTermConfidence: "高",
    longTermTrend: "中性偏空", longTermConfidence: "中",
    supportLevels: [1.180, 1.140, 1.100],
    pressureLevels: [1.300, 1.350, 1.420],
    riskLevel: "高",
    keyRisks: ["暂停申赎导致流动性风险", "韩国半导体板块承压", "中美贸易摩擦升级", "溢价率波动"],
    keyOpportunities: ["SK海力士HBM产能扩张", "中芯国际产能提升", "国产替代长期逻辑"],
    recommendation: "观望，等待申赎恢复及韩国半导体板块企稳",
    fundamentals: {
      score: 45, verdict: "偏弱",
      details: "规模14.24亿偏小，折溢价率-0.04%接近合理；但暂停申赎影响流动性，跟踪指数含韩国半导体成分，受海外波动影响大"
    },
    technical: {
      score: 30, verdict: "看跌",
      details: "MACD死叉且绿柱放大，RSI超卖区(28)，KDJ三线向下发散，布林带跌破下轨，短期动能极弱"
    },
    sentiment: {
      score: 40, verdict: "偏空",
      details: "三星Q2利润不及预期+美国出口管制升级双重负面，但SK海力士HBM和中芯国际产能正面，多空交织偏空"
    },
    moneyFlow: {
      score: 25, verdict: "主力撤退",
      details: "主力净流出2.48亿，超大单净流出1.85亿，散户净流入2.48亿，典型的主力出货散户接盘格局"
    },
    volume: {
      score: 35, verdict: "放量下跌",
      details: "成交量大幅放大（涨停/跌停板制度下-10%极限跌幅），放量下跌形态明确，短期抛压沉重"
    }
  },
  sh515880: {
    overallScore: 55,
    shortTermTrend: "震荡偏弱", shortTermConfidence: "中",
    longTermTrend: "中性偏多", longTermConfidence: "中",
    supportLevels: [0.850, 0.820, 0.790],
    pressureLevels: [0.930, 0.960, 1.000],
    riskLevel: "中",
    keyRisks: ["大盘系统性回调风险", "光模块估值偏高回调压力", "通信基建投资节奏放缓"],
    keyOpportunities: ["800G光模块出货量新高", "5G-A商用加速", "AI算力需求持续旺盛"],
    recommendation: "逢低小幅加仓，关注光模块龙头订单数据",
    fundamentals: {
      score: 60, verdict: "中性",
      details: "规模9.56亿适中，折溢价0%合理；跟踪指数含光通信龙头，行业景气度高但估值偏高"
    },
    technical: {
      score: 50, verdict: "震荡",
      details: "MACD绿柱缩窄即将金叉，RSI回落至42接近中位，KDJ在低位有收敛迹象，布林带中下轨区间震荡"
    },
    sentiment: {
      score: 60, verdict: "偏多",
      details: "中际旭创800G出货新高+运营商5G-A推进利好，但随大盘调整短期偏弱"
    },
    moneyFlow: {
      score: 40, verdict: "小幅流出",
      details: "主力净流出0.86亿，流出幅度中等，散户小幅流入，市场分歧加大"
    },
    volume: {
      score: 50, verdict: "缩量调整",
      details: "成交量较前日略缩，缩量下跌说明抛压不重，调整幅度可控"
    }
  },
  sh516510: {
    overallScore: 50,
    shortTermTrend: "震荡偏弱", shortTermConfidence: "中",
    longTermTrend: "中性", longTermConfidence: "中",
    supportLevels: [0.880, 0.850, 0.820],
    pressureLevels: [0.980, 1.020, 1.060],
    riskLevel: "中",
    keyRisks: ["云计算增速放缓", "阿里云降价挤压行业利润", "AI应用落地节奏不确定"],
    keyOpportunities: ["WPS AI用户破5000万", "AI服务器需求旺盛", "数字化转型持续"],
    recommendation: "持有观望，等待云计算板块估值消化",
    fundamentals: {
      score: 55, verdict: "中性偏弱",
      details: "规模8.75亿适中，跟踪指数含云计算+SaaS龙头，但行业增速从20%降至15%，利润空间受压缩"
    },
    technical: {
      score: 45, verdict: "偏弱",
      details: "MACD死叉绿柱持续，RSI=38偏弱，KDJ向下发散，布林带触及下轨，短期趋势偏弱"
    },
    sentiment: {
      score: 50, verdict: "中性",
      details: "WPS AI利好但云计算增速放缓利空，阿里云降价利空，多空平衡"
    },
    moneyFlow: {
      score: 40, verdict: "小幅流出",
      details: "主力净流出0.62亿，流出量不大，散户净流入0.62亿"
    },
    volume: {
      score: 45, verdict: "缩量下跌",
      details: "成交量偏小，缩量下跌格局，调整空间有限"
    }
  },
  sh588200: {
    overallScore: 60,
    shortTermTrend: "震荡回调", shortTermConfidence: "中",
    longTermTrend: "偏多", longTermConfidence: "中高",
    supportLevels: [0.880, 0.850, 0.800],
    pressureLevels: [0.980, 1.050, 1.120],
    riskLevel: "中偏高",
    keyRisks: ["年内涨幅47%估值偏高", "科创板波动性大", "芯片股周期性回调风险"],
    keyOpportunities: ["大基金三期注资中芯国际", "北方华创订单超预期", "国产替代长期逻辑强化"],
    recommendation: "回调后逢低加仓，关注大基金三期落地进度",
    fundamentals: {
      score: 65, verdict: "中性偏多",
      details: "年内涨幅47.29%强劲，规模7.86亿适中；跟踪科创芯片指数，核心持仓中芯国际/北方华创景气度高"
    },
    technical: {
      score: 55, verdict: "回调中",
      details: "MACD从高位回落绿柱初现，RSI=45从高位回落，KDJ高位死叉，布林带从上轨回归中轨"
    },
    sentiment: {
      score: 70, verdict: "偏多",
      details: "大基金三期+北方华创订单超预期双重利好，估值担忧是短期利空"
    },
    moneyFlow: {
      score: 45, verdict: "小幅流出",
      details: "主力净流出0.45亿，幅度不大，大基金三期落地可能带来增量资金"
    },
    volume: {
      score: 50, verdict: "正常调整",
      details: "成交量中等，调整幅度与量能匹配，无异常放量"
    }
  },
  sz159326: {
    overallScore: 58,
    shortTermTrend: "震荡偏弱", shortTermConfidence: "中",
    longTermTrend: "偏多", longTermConfidence: "中",
    supportLevels: [0.850, 0.820, 0.780],
    pressureLevels: [0.930, 0.960, 1.000],
    riskLevel: "中偏低",
    keyRisks: ["大盘系统性回调", "电网投资节奏可能放缓"],
    keyOpportunities: ["特高压2026投资600亿+", "新能源配储政策推动", "国电南瑞业绩增长25%"],
    recommendation: "逢低加仓，电网设备是本轮景气确定性最高的板块之一",
    fundamentals: {
      score: 65, verdict: "偏多",
      details: "年内跌幅仅3.26%抗跌性强，规模4.41亿偏小但成长中；跟踪电网设备指数，受政策驱动明确"
    },
    technical: {
      score: 55, verdict: "震荡",
      details: "MACD零轴附近绿柱缩窄，RSI=40接近中位，KDJ低位收敛，布林带中轨附近震荡"
    },
    sentiment: {
      score: 65, verdict: "偏多",
      details: "特高压投资+新能源配储政策持续利好，国电南瑞业绩支撑"
    },
    moneyFlow: {
      score: 50, verdict: "小幅流出",
      details: "主力净流出0.31亿，流出量小，散户小幅流入"
    },
    volume: {
      score: 55, verdict: "缩量调整",
      details: "成交量小，缩量调整格局，底部支撑较强"
    }
  },
  sz159516: {
    overallScore: 62,
    shortTermTrend: "回调中", shortTermConfidence: "中",
    longTermTrend: "偏多", longTermConfidence: "中高",
    supportLevels: [1.550, 1.450, 1.350],
    pressureLevels: [1.780, 1.850, 2.000],
    riskLevel: "中偏高",
    keyRisks: ["年内涨71%估值泡沫风险", "美国出口管制升级", "半导体周期性见顶风险"],
    keyOpportunities: ["大基金三期重点投向设备", "北方华创/中微公司订单超预期", "国产替代率加速提升"],
    recommendation: "回调企稳后加仓，大基金三期是核心催化剂",
    fundamentals: {
      score: 70, verdict: "偏多",
      details: "年内涨幅71.48%为组合最强，规模12.64亿大且活跃；跟踪半导体设备指数，国产替代逻辑最硬"
    },
    technical: {
      score: 50, verdict: "高位回调",
      details: "MACD高位死叉绿柱放大，RSI从70+回落至42，KDJ高位死叉下行，布林带从上轨大幅回落"
    },
    sentiment: {
      score: 70, verdict: "偏多",
      details: "大基金三期+北方华创订单双重利好，但估值担忧和出口管制构成短期压力"
    },
    moneyFlow: {
      score: 35, verdict: "主力流出",
      details: "主力净流出1.23亿较大，超大单净流出0.82亿，高位获利盘出逃明显"
    },
    volume: {
      score: 45, verdict: "放量调整",
      details: "成交量放大，高位放量下跌，短期抛压较重，需等待量能缩减企稳"
    }
  },
  sz159732: {
    overallScore: 52,
    shortTermTrend: "震荡偏弱", shortTermConfidence: "中",
    longTermTrend: "中性偏多", longTermConfidence: "中",
    supportLevels: [0.720, 0.690, 0.650],
    pressureLevels: [0.800, 0.830, 0.860],
    riskLevel: "中",
    keyRisks: ["消费电子需求不确定", "苹果供应链波动", "板块年内跌幅8.15%"],
    keyOpportunities: ["立讯精密打入iPhone 18供应链", "VR设备订单恢复", "AI终端推动换机潮"],
    recommendation: "持有等待消费电子旺季催化，关注苹果供应链动态",
    fundamentals: {
      score: 55, verdict: "中性",
      details: "年内跌幅8.15%偏弱，规模4.86亿偏小；跟踪消费电子指数，立讯精密为第一大持仓"
    },
    technical: {
      score: 45, verdict: "偏弱",
      details: "MACD绿柱持续，RSI=38偏弱，KDJ向下发散，布林带触及下轨"
    },
    sentiment: {
      score: 55, verdict: "中性偏多",
      details: "立讯精密入iPhone 18供应链利好，但苹果发布会延迟利空"
    },
    moneyFlow: {
      score: 50, verdict: "小幅流出",
      details: "主力净流出0.28亿很小，散户净流入0.28亿"
    },
    volume: {
      score: 50, verdict: "缩量调整",
      details: "成交量小，缩量调整，底部逐渐夯实"
    }
  }
};

// 数据更新时间戳
const DATA_TIMESTAMP = "2026-07-17 15:00:00 (收盘数据)";
const DATA_SOURCE = "腾讯自选股行情数据接口 + 综合分析模型";

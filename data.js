// =====================================================================
// ETF 多维度分析数据集  v3.0
// 架构: 3独立分组(持仓/科创系/宽基) + 双分析模式(短线波段/长期定投)
//       + 四级风险(绿/黄/浅红/深红) + 固定阈值(2026 A股ETF标准)
// 数据采集基准: 2026-07-17 收盘快照 (盘中由自动化在4时点刷新)
// 数据来源: 腾讯自选股行情接口 + 综合分析模型
// =====================================================================

// ---------- 0. 工具: 确定性伪随机(保证种子数据稳定) ----------
function _hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------- 1. 全局交易配置(4时点, 非交易日停止) ----------
const TRADE_CONFIG = {
  isTradingDayNote: "仅交易日 09:31/11:31/13:31/16:00 自动刷新；法定节假日/周末由自动化前置判断后跳过",
  snapshotTimes: ["09:31", "11:31", "13:31", "16:00"],
  rrule: "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"
};

// ---------- 2. 四级风险分级(固定, 不可脚本修改) ----------
const RISK_GRADES = {
  "green":      { key: "green",      label: "绿", desc: "机会加仓",     color: "#27ae60", bg: "#eafaf1", action: "机会加仓" },
  "yellow":     { key: "yellow",     label: "黄", desc: "短线博弈",     color: "#f39c12", bg: "#fef5e7", action: "短线博弈" },
  "light-red":  { key: "light-red",  label: "浅红", desc: "观望换仓",   color: "#e67e22", bg: "#fdf0e6", action: "观望换仓" },
  "deep-red":   { key: "deep-red",   label: "深红", desc: "立即减仓清仓", color: "#c0392b", bg: "#fbeae8", action: "立即减仓清仓" }
};

// ---------- 3. 固定阈值(2026 A股ETF现行标准, 引擎只读, 不得自行修改) ----------
const THRESHOLDS = {
  // —— 短线波段模式阈值 ——
  shortTerm: {
    rsi:        { oversold: 30, overbought: 70 },            // RSI(14) 超卖/超买
    macd:       { goldenBullish: true, deadBearish: true },  // 金叉偏多 / 死叉偏空
    mainFlow:   { strongIn: 0.3, strongOut: -0.3 },          // 主力净流入(亿) 强流入/强流出
    premium:    { arb: 0.5 },                                // 折溢价率% 超过即异常/可套利
    volumeRatio:{ high: 2.2, low: 0.6 },                     // 量比 高位/低位
    changePct:  { bigUp: 5, bigDown: -5, limitUp: 10, limitDown: -10 },
    maAlign:    { bull: "多头排列", bear: "空头排列" }
  },
  // —— 长期定投模式阈值 ——
  longTerm: {
    pePercentile:   { cheap: 30, expensive: 70 },            // 指数PE历史分位%
    pbPercentile:   { cheap: 30, expensive: 70 },            // 指数PB历史分位%
    drawdown:       { deep: -30 },                           // 最大回撤% 深度
    ytdReturn:      { hot: 50, cold: -20 },                  // 年内收益% 过热/过冷
    scaleGrowth:    { strong: 10 },                          // 份额(规模)增长% 强势
    trackError:     { ok: 0.5 }                              // 跟踪误差% 可接受上限
  },
  // —— 持仓分组专用(止损止盈) ——
  holding: {
    stopLossPct:    -8,    // 短线止损线(较成本价)
    trailingStop:   -15,   // 趋势破位止损线
    takeProfitPct:  20,    // 短线止盈线
    addOnDipPct:    -12    // 分批加仓触发(较成本回撤)
  }
};

// ---------- 4. 双分析模式 ----------
const ANALYSIS_MODES = {
  shortTerm: { key: "shortTerm", label: "短线波段", desc: "重技术动能/资金流/IOPV折溢价，抓1-2周波段" },
  longTerm:  { key: "longTerm",  label: "长期定投", desc: "重估值分位/长期趋势/回撤/规模增长，按季定投" }
};

// ---------- 5. 3个独立分组(分开计算/输出/建议) ----------
const ETF_GROUPS = {
  holdings: {
    id: "holdings", name: "我的持仓ETF", icon: "💼",
    desc: "本人持有，重点兼顾持仓盈亏、止损止盈、减仓提示",
    codes: ["sh513310", "sh515880", "sh516510", "sh588200", "sz159326", "sz159516", "sz159732"]
  },
  star: {
    id: "star", name: "全科创系ETF", icon: "🔬",
    desc: "科创50/100/200/芯片/成长/科创创业50，观察池与持仓分开计算",
    codes: ["sh588000", "sh588030", "sh588240", "sh588200", "sh588110", "sh588400"]
  },
  broad: {
    id: "broad", name: "宽基大盘ETF", icon: "🏛️",
    desc: "沪深300/中证500/中证1000/上证50/创业板/中证红利，全市场宽基观察池",
    codes: ["sh510300", "sh510500", "sh512100", "sh510050", "sz159915", "sh515080"]
  }
};

// 全部标的(去重)
const ALL_CODES = (() => {
  const s = new Set();
  Object.values(ETF_GROUPS).forEach(g => g.codes.forEach(c => s.add(c)));
  return [...s];
})();

// ---------- 6. 持仓成本价(可编辑占位) ----------
// ⚠️ 占位示例：真实成本价可在网页右上角「设置持仓成本」直接填写（存浏览器 localStorage，优先于此处）
//    也可在此把 cost/shares 改成真实值、并把 configured 改为 true，分组1 才会显示真实盈亏/止损止盈/减仓提示
const MY_HOLDINGS = {
  configured: false,
  sh513310: { cost: 1.214, shares: 10000 },
  sh515880: { cost: 0.881, shares: 10000 },
  sh516510: { cost: 0.920, shares: 10000 },
  sh588200: { cost: 0.925, shares: 10000 },
  sz159326: { cost: 0.878, shares: 10000 },
  sz159516: { cost: 1.668, shares: 10000 },
  sz159732: { cost: 0.758, shares: 10000 }
};

// =====================================================================
// 7. 基础行情/详情/资金流 (持仓7只 = 现有数据；新ETF由种子生成补齐)
// =====================================================================
const QUOTE_DATA = {
  sh513310: { name: "中韩半导体ETF", price: 1.214, change: -0.134, changePct: -10.00, open: 1.270, high: 1.348, low: 1.210, preClose: 1.348, volume: 67684200, turnover: 85815000, amount: 104708900, marketCap: 14.24, suspended: true, suspendInfo: "暂停申购/赎回" },
  sh515880: { name: "通信ETF", price: 0.881, change: -0.042, changePct: -4.74, open: 0.911, high: 0.931, low: 0.876, preClose: 0.923, volume: 10862700, turnover: 10042000, amount: 9445000, marketCap: 9.56 },
  sh516510: { name: "云计算ETF", price: 0.920, change: -0.048, changePct: -5.22, open: 0.952, high: 0.978, low: 0.913, preClose: 0.968, volume: 5791300, turnover: 5562000, amount: 5265000, marketCap: 8.75 },
  sh588200: { name: "科创芯片ETF", price: 0.925, change: -0.048, changePct: -5.19, open: 0.960, high: 0.981, low: 0.916, preClose: 0.973, volume: 5346300, turnover: 4997000, amount: 4738000, marketCap: 7.86 },
  sz159326: { name: "电网设备ETF", price: 0.878, change: -0.042, changePct: -4.77, open: 0.908, high: 0.931, low: 0.872, preClose: 0.920, volume: 3428600, turnover: 3094000, amount: 2906000, marketCap: 4.41 },
  sz159516: { name: "半导体设备ETF", price: 1.668, change: -0.086, changePct: -5.14, open: 1.722, high: 1.782, low: 1.647, preClose: 1.754, volume: 7963500, turnover: 13648000, amount: 12960000, marketCap: 12.64 },
  sz159732: { name: "消费电子ETF", price: 0.758, change: -0.036, changePct: -4.59, open: 0.782, high: 0.801, low: 0.748, preClose: 0.794, volume: 5174200, turnover: 3945000, amount: 3724000, marketCap: 4.86 }
};

const ETF_DETAIL = {
  sh513310: { nav: 1.2145, accNav: 1.2145, premiumRate: -0.04, size: 14.24, yieldYtd: -14.85, yield1m: -10.00, maxDrawdown: -35.2, manager: "柳军", established: "2023-07-07", status: "暂停申购赎回", topHoldings: ["三星电子","SK海力士","中芯国际","北方华创","韦尔股份","长电科技","兆易创新","紫光国微","澜起科技","晶晨股份"] },
  sh515880: { nav: 0.881, accNav: 0.881, premiumRate: 0.00, size: 9.56, yieldYtd: -5.62, yield1m: -4.74, maxDrawdown: -18.6, manager: "梁杏", established: "2020-01-03", topHoldings: ["中兴通讯","中际旭创","新易盛","天孚通信","光迅科技","亨通光电","烽火通信","紫光股份","星网锐捷","华工科技"] },
  sh516510: { nav: 0.920, accNav: 0.920, premiumRate: 0.00, size: 8.75, yieldYtd: -7.83, yield1m: -5.22, maxDrawdown: -22.4, manager: "张湛", established: "2021-04-20", topHoldings: ["金山办公","中科曙光","浪潮信息","紫光股份","光环新网","宝信软件","用友网络","广联达","同花顺","恒生电子"] },
  sh588200: { nav: 0.925, accNav: 0.925, premiumRate: 0.00, size: 7.86, yieldYtd: 47.29, yield1m: -5.19, maxDrawdown: -28.8, manager: "周宇驰", established: "2022-09-30", topHoldings: ["中芯国际","北方华创","韦尔股份","澜起科技","晶晨股份","沪硅产业","华熙生物","君实生物","金山办公","传音控股"] },
  sz159326: { nav: 0.878, accNav: 0.878, premiumRate: 0.00, size: 4.41, yieldYtd: -3.26, yield1m: -4.77, maxDrawdown: -15.8, manager: "李俊", established: "2024-06-07", topHoldings: ["国电南瑞","许继电气","平高电气","中国西电","思源电气","特变电工","金盘科技","华明装备","长高集团","保变电气"] },
  sz159516: { nav: 1.668, accNav: 1.668, premiumRate: 0.00, size: 12.64, yieldYtd: 71.48, yield1m: -5.14, maxDrawdown: -32.5, manager: "梁杏", established: "2022-09-30", topHoldings: ["北方华创","中微公司","芯源微","华海清科","盛美半导体","拓荆科技","长川科技","精测电子","万业企业","至纯科技"] },
  sz159732: { nav: 0.758, accNav: 0.758, premiumRate: 0.00, size: 4.86, yieldYtd: -8.15, yield1m: -4.59, maxDrawdown: -21.3, manager: "李俊", established: "2023-06-05", topHoldings: ["立讯精密","歌尔股份","传音控股","漫步者","蓝思科技","领益智造","环旭电子","安克创新","佳禾智能","共达电声"] }
};

const FUND_FLOW = {
  sh513310: { mainNetInflow: -2.48, mainInflow: 3.12, mainOutflow: 5.60, retailNetInflow: 2.48, superLargeNet: -1.85, largeNet: -0.63, mediumNet: 0.82, smallNet: 1.66 },
  sh515880: { mainNetInflow: -0.86, mainInflow: 1.24, mainOutflow: 2.10, retailNetInflow: 0.86, superLargeNet: -0.52, largeNet: -0.34, mediumNet: 0.38, smallNet: 0.48 },
  sh516510: { mainNetInflow: -0.62, mainInflow: 0.95, mainOutflow: 1.57, retailNetInflow: 0.62, superLargeNet: -0.38, largeNet: -0.24, mediumNet: 0.29, smallNet: 0.33 },
  sh588200: { mainNetInflow: -0.45, mainInflow: 0.78, mainOutflow: 1.23, retailNetInflow: 0.45, superLargeNet: -0.28, largeNet: -0.17, mediumNet: 0.21, smallNet: 0.24 },
  sz159326: { mainNetInflow: -0.31, mainInflow: 0.52, mainOutflow: 0.83, retailNetInflow: 0.31, superLargeNet: -0.18, largeNet: -0.13, mediumNet: 0.15, smallNet: 0.16 },
  sz159516: { mainNetInflow: -1.23, mainInflow: 2.05, mainOutflow: 3.28, retailNetInflow: 1.23, superLargeNet: -0.82, largeNet: -0.41, mediumNet: 0.58, smallNet: 0.65 },
  sz159732: { mainNetInflow: -0.28, mainInflow: 0.46, mainOutflow: 0.74, retailNetInflow: 0.28, superLargeNet: -0.16, largeNet: -0.12, mediumNet: 0.13, smallNet: 0.15 }
};

const ETF_SPECIFIC = {
  sh513310: { totalShares: 11.74, circulationShares: 11.74, shareChangePct: -2.1, pcf: [["三星电子",12.5],["SK海力士",11.2],["中芯国际",9.8],["北方华创",8.1],["韦尔股份",6.5]], premiumRate: -0.04, premiumDeviation: 0.04, marginBalance: 0.82, marginLending: 0.05, trackingIndex: { name: "中韩半导体指数", code: "931790", changePct: -9.8 } },
  sh515880: { totalShares: 10.86, circulationShares: 10.86, shareChangePct: 0.8, pcf: [["中兴通讯",10.5],["中际旭创",9.8],["新易盛",8.6],["天孚通信",7.2],["光迅科技",6.1]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 1.45, marginLending: 0.12, trackingIndex: { name: "中证通信主题指数", code: "000916", changePct: -4.5 } },
  sh516510: { totalShares: 9.51, circulationShares: 9.51, shareChangePct: 0.3, pcf: [["金山办公",11.2],["中科曙光",9.5],["浪潮信息",8.8],["紫光股份",7.9],["光环新网",6.3]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 0.95, marginLending: 0.08, trackingIndex: { name: "中证云计算与大数据指数", code: "930851", changePct: -5.0 } },
  sh588200: { totalShares: 8.49, circulationShares: 8.49, shareChangePct: 1.5, pcf: [["中芯国际",12.1],["北方华创",10.5],["韦尔股份",9.2],["澜起科技",8.0],["晶晨股份",6.8]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 1.88, marginLending: 0.21, trackingIndex: { name: "科创芯片指数", code: "000685", changePct: -5.1 } },
  sz159326: { totalShares: 5.02, circulationShares: 5.02, shareChangePct: 0.5, pcf: [["国电南瑞",11.8],["许继电气",9.2],["平高电气",8.0],["中国西电",7.1],["思源电气",6.5]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 0.42, marginLending: 0.03, trackingIndex: { name: "中证电网设备指数", code: "931535", changePct: -4.6 } },
  sz159516: { totalShares: 7.58, circulationShares: 7.58, shareChangePct: 2.3, pcf: [["北方华创",12.5],["中微公司",10.8],["芯源微",8.5],["华海清科",7.6],["盛美上海",6.9]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 1.62, marginLending: 0.18, trackingIndex: { name: "中证半导体材料设备指数", code: "931743", changePct: -5.0 } },
  sz159732: { totalShares: 6.41, circulationShares: 6.41, shareChangePct: 0.2, pcf: [["立讯精密",12.0],["歌尔股份",9.5],["传音控股",8.3],["漫步者",7.0],["蓝思科技",6.2]], premiumRate: 0.00, premiumDeviation: 0.00, marginBalance: 0.68, marginLending: 0.06, trackingIndex: { name: "中证消费电子主题指数", code: "931494", changePct: -4.3 } }
};

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
    { date: "2026-07-03", title: "全球AI算力需求持续旺盛，光通信受益", source: "TrendForce", impact: "正面" }
  ],
  sh516510: [
    { date: "2026-07-17", title: "云计算板块回调，金山办公领跌", source: "东方财富", impact: "负面" },
    { date: "2026-07-14", title: "金山办公WPS AI功能用户数突破5000万", source: "公司公告", impact: "正面" },
    { date: "2026-07-09", title: "浪潮信息发布新一代AI服务器", source: "公司公告", impact: "正面" },
    { date: "2026-07-04", title: "云计算市场Q2增速放缓至15%", source: "IDC报告", impact: "中性" }
  ],
  sh588200: [
    { date: "2026-07-17", title: "科创芯片ETF年内涨幅47%后遭遇调整", source: "中国证券报", impact: "中性" },
    { date: "2026-07-13", title: "中芯国际获大基金三期注资", source: "大基金公告", impact: "正面" },
    { date: "2026-07-08", title: "北方华创半导体设备订单超预期", source: "公司公告", impact: "正面" },
    { date: "2026-07-03", title: "科创板芯片股估值偏高引发市场担忧", source: "证券时报", impact: "负面" }
  ],
  sz159326: [
    { date: "2026-07-17", title: "电网设备板块随大盘回调", source: "证券时报", impact: "负面" },
    { date: "2026-07-12", title: "国电南瑞Q2营收同比增长25%", source: "公司公告", impact: "正面" },
    { date: "2026-07-07", title: "特高压建设规划2026年投资超600亿", source: "国家电网", impact: "正面" },
    { date: "2026-07-02", title: "新能源配储政策推动电网设备需求", source: "发改委", impact: "正面" }
  ],
  sz159516: [
    { date: "2026-07-17", title: "半导体设备ETF年内涨71%后大幅回调5.14%", source: "中国证券报", impact: "中性" },
    { date: "2026-07-13", title: "北方华创获大基金三期战略投资", source: "大基金公告", impact: "正面" },
    { date: "2026-07-08", title: "中微公司刻蚀设备出货量创历史新高", source: "公司公告", impact: "正面" },
    { date: "2026-07-03", title: "美国半导体出口管制升级影响设备国产替代进程", source: "商务部", impact: "负面" }
  ],
  sz159732: [
    { date: "2026-07-17", title: "消费电子板块跟随大盘调整", source: "东方财富", impact: "负面" },
    { date: "2026-07-12", title: "立讯精密打入苹果iPhone 18供应链", source: "产业链消息", impact: "正面" },
    { date: "2026-07-07", title: "消费电子Q2出货量环比回升", source: "IDC数据", impact: "正面" },
    { date: "2026-07-02", title: "苹果新品发布会延迟影响供应链预期", source: "彭博社", impact: "负面" }
  ]
};

// =====================================================================
// 8. 4类新数据源 (全部18只)
// =====================================================================
// 8.1 两融数据 (融资余额/融券余量/变化)
const MARGIN_DATA = {
  sh513310: { balance: 0.82, lending: 0.05, changePct: -1.2, change5d: -3.5 },
  sh515880: { balance: 1.45, lending: 0.12, changePct: 0.8, change5d: 2.1 },
  sh516510: { balance: 0.95, lending: 0.08, changePct: 0.3, change5d: 1.0 },
  sh588200: { balance: 1.88, lending: 0.21, changePct: 1.5, change5d: 4.2 },
  sz159326: { balance: 0.42, lending: 0.03, changePct: 0.5, change5d: 1.2 },
  sz159516: { balance: 1.62, lending: 0.18, changePct: 2.3, change5d: 5.5 },
  sz159732: { balance: 0.68, lending: 0.06, changePct: 0.2, change5d: 0.8 },
  sh588000: { balance: 22.4, lending: 1.1, changePct: 1.2, change5d: 3.0 },
  sh588030: { balance: 3.8, lending: 0.2, changePct: 1.0, change5d: 2.5 },
  sh588240: { balance: 1.5, lending: 0.08, changePct: 0.6, change5d: 1.8 },
  sh588110: { balance: 0.9, lending: 0.05, changePct: 0.4, change5d: 1.2 },
  sh588400: { balance: 2.1, lending: 0.1, changePct: 0.7, change5d: 2.0 },
  sh510300: { balance: 78.5, lending: 3.2, changePct: 0.5, change5d: 1.5 },
  sh510500: { balance: 32.1, lending: 1.4, changePct: 0.4, change5d: 1.2 },
  sh512100: { balance: 12.6, lending: 0.6, changePct: 0.6, change5d: 1.6 },
  sh510050: { balance: 52.3, lending: 2.1, changePct: 0.3, change5d: 1.0 },
  sz159915: { balance: 28.7, lending: 1.2, changePct: 0.5, change5d: 1.4 },
  sh515080: { balance: 4.2, lending: 0.15, changePct: 0.2, change5d: 0.8 }
};

// 8.2 北向资金 (以标的/指数代理净买入, 亿)
const NORTHBOUND_DATA = {
  sh513310: { netBuy: -0.35, netBuy5d: -1.2, hkHoldPct: 3.2 },
  sh515880: { netBuy: 0.12, netBuy5d: 0.4, hkHoldPct: 2.1 },
  sh516510: { netBuy: 0.05, netBuy5d: 0.2, hkHoldPct: 1.8 },
  sh588200: { netBuy: -0.18, netBuy5d: -0.5, hkHoldPct: 4.5 },
  sz159326: { netBuy: 0.08, netBuy5d: 0.3, hkHoldPct: 1.5 },
  sz159516: { netBuy: -0.22, netBuy5d: -0.6, hkHoldPct: 3.8 },
  sz159732: { netBuy: 0.03, netBuy5d: 0.1, hkHoldPct: 2.0 },
  sh588000: { netBuy: -0.6, netBuy5d: -1.8, hkHoldPct: 5.2 },
  sh588030: { netBuy: -0.2, netBuy5d: -0.6, hkHoldPct: 2.4 },
  sh588240: { netBuy: -0.1, netBuy5d: -0.3, hkHoldPct: 1.1 },
  sh588110: { netBuy: -0.12, netBuy5d: -0.4, hkHoldPct: 1.3 },
  sh588400: { netBuy: -0.15, netBuy5d: -0.5, hkHoldPct: 1.6 },
  sh510300: { netBuy: 1.2, netBuy5d: 3.5, hkHoldPct: 4.8 },
  sh510500: { netBuy: 0.4, netBuy5d: 1.2, hkHoldPct: 3.1 },
  sh512100: { netBuy: 0.2, netBuy5d: 0.6, hkHoldPct: 2.2 },
  sh510050: { netBuy: 0.9, netBuy5d: 2.8, hkHoldPct: 5.5 },
  sz159915: { netBuy: 0.5, netBuy5d: 1.5, hkHoldPct: 3.6 },
  sh515080: { netBuy: 0.15, netBuy5d: 0.5, hkHoldPct: 1.9 }
};

// 8.3 指数估值 (PE/PB 及历史分位)
const VALUATION_DATA = {
  sh513310: { indexName: "中韩半导体", pe: 28, pePercentile: 65, pb: 2.6, pbPercentile: 60, roe: 9.3 },
  sh515880: { indexName: "中证通信", pe: 24, pePercentile: 55, pb: 2.8, pbPercentile: 50, roe: 11.6 },
  sh516510: { indexName: "云计算与大数据", pe: 40, pePercentile: 60, pb: 4.0, pbPercentile: 55, roe: 10.0 },
  sh588200: { indexName: "科创芯片", pe: 65, pePercentile: 75, pb: 4.8, pbPercentile: 70, roe: 7.4 },
  sz159326: { indexName: "中证电网设备", pe: 20, pePercentile: 40, pb: 2.4, pbPercentile: 35, roe: 12.0 },
  sz159516: { indexName: "半导体材料设备", pe: 55, pePercentile: 78, pb: 5.5, pbPercentile: 72, roe: 10.2 },
  sz159732: { indexName: "中证消费电子", pe: 30, pePercentile: 45, pb: 3.2, pbPercentile: 40, roe: 10.8 },
  sh588000: { indexName: "科创50", pe: 45, pePercentile: 55, pb: 4.2, pbPercentile: 50, roe: 9.0 },
  sh588030: { indexName: "科创100", pe: 60, pePercentile: 60, pb: 3.5, pbPercentile: 55, roe: 8.5 },
  sh588240: { indexName: "科创200", pe: 75, pePercentile: 70, pb: 3.0, pbPercentile: 60, roe: 7.8 },
  sh588110: { indexName: "科创成长", pe: 50, pePercentile: 58, pb: 4.0, pbPercentile: 52, roe: 9.2 },
  sh588400: { indexName: "科创创业50", pe: 38, pePercentile: 45, pb: 5.0, pbPercentile: 55, roe: 11.0 },
  sh510300: { indexName: "沪深300", pe: 12.5, pePercentile: 40, pb: 1.35, pbPercentile: 35, roe: 10.8 },
  sh510500: { indexName: "中证500", pe: 22, pePercentile: 45, pb: 1.7, pbPercentile: 40, roe: 7.8 },
  sh512100: { indexName: "中证1000", pe: 30, pePercentile: 50, pb: 2.0, pbPercentile: 45, roe: 6.5 },
  sh510050: { indexName: "上证50", pe: 10.5, pePercentile: 38, pb: 1.2, pbPercentile: 30, roe: 11.5 },
  sz159915: { indexName: "创业板指", pe: 32, pePercentile: 35, pb: 4.0, pbPercentile: 38, roe: 12.5 },
  sh515080: { indexName: "中证红利", pe: 7.5, pePercentile: 25, pb: 0.85, pbPercentile: 20, roe: 11.0 }
};

// 8.4 基金季报 (规模变动/持仓稳定性/跟踪误差)
const QUARTERLY_DATA = {
  sh513310: { reportDate: "2026-06-30", aumChangePct: -2.1, topHoldingsStable: true, trackError: 0.35, dividendYield: 0 },
  sh515880: { reportDate: "2026-06-30", aumChangePct: 0.8, topHoldingsStable: true, trackError: 0.28, dividendYield: 0 },
  sh516510: { reportDate: "2026-06-30", aumChangePct: 0.3, topHoldingsStable: true, trackError: 0.30, dividendYield: 0 },
  sh588200: { reportDate: "2026-06-30", aumChangePct: 1.5, topHoldingsStable: true, trackError: 0.42, dividendYield: 0 },
  sz159326: { reportDate: "2026-06-30", aumChangePct: 0.5, topHoldingsStable: true, trackError: 0.25, dividendYield: 0 },
  sz159516: { reportDate: "2026-06-30", aumChangePct: 2.3, topHoldingsStable: true, trackError: 0.38, dividendYield: 0 },
  sz159732: { reportDate: "2026-06-30", aumChangePct: 0.2, topHoldingsStable: true, trackError: 0.33, dividendYield: 0 },
  sh588000: { reportDate: "2026-06-30", aumChangePct: 3.0, topHoldingsStable: true, trackError: 0.30, dividendYield: 0 },
  sh588030: { reportDate: "2026-06-30", aumChangePct: 2.2, topHoldingsStable: true, trackError: 0.40, dividendYield: 0 },
  sh588240: { reportDate: "2026-06-30", aumChangePct: 1.8, topHoldingsStable: true, trackError: 0.45, dividendYield: 0 },
  sh588110: { reportDate: "2026-06-30", aumChangePct: 1.2, topHoldingsStable: true, trackError: 0.42, dividendYield: 0 },
  sh588400: { reportDate: "2026-06-30", aumChangePct: 1.6, topHoldingsStable: true, trackError: 0.50, dividendYield: 0 },
  sh510300: { reportDate: "2026-06-30", aumChangePct: 4.5, topHoldingsStable: true, trackError: 0.05, dividendYield: 2.1 },
  sh510500: { reportDate: "2026-06-30", aumChangePct: 3.2, topHoldingsStable: true, trackError: 0.08, dividendYield: 1.8 },
  sh512100: { reportDate: "2026-06-30", aumChangePct: 2.8, topHoldingsStable: true, trackError: 0.10, dividendYield: 1.2 },
  sh510050: { reportDate: "2026-06-30", aumChangePct: 3.6, topHoldingsStable: true, trackError: 0.04, dividendYield: 2.4 },
  sz159915: { reportDate: "2026-06-30", aumChangePct: 3.0, topHoldingsStable: true, trackError: 0.10, dividendYield: 1.0 },
  sh515080: { reportDate: "2026-06-30", aumChangePct: 5.2, topHoldingsStable: true, trackError: 0.12, dividendYield: 3.8 }
};

// =====================================================================
// 9. 新增11只ETF 种子数据 (确定性生成, 自动化盘中覆盖)
// =====================================================================
const SEED_NEW_ETFS = [
  { code: "sh588000", name: "科创50ETF", provider: "华夏", fullCode: "588000", price: 1.050, changePct: -4.8, open: 1.103, high: 1.110, low: 1.045, preClose: 1.103, size: 950, ytd: 8.5, ytd1m: -4.8, maxDD: -28.0, manager: "荣膺", established: "2020-09-28", topHoldings: ["中芯国际","海光信息","中微公司","金山办公","寒武纪","澜起科技","联影医疗","传音控股","沪硅产业","华润微"], trackingIndex: { name: "科创50", code: "000688", changePct: -4.8 }, news: [ { date: "2026-07-17", title: "科创50跟随大盘调整, 半导体权重拖累", source: "证券时报", impact: "负面" }, { date: "2026-07-10", title: "科创50成分股中报预喜比例超六成", source: "中国证券报", impact: "正面" } ] },
  { code: "sh588030", name: "科创100ETF", provider: "博时", fullCode: "588030", price: 0.920, changePct: -5.3, open: 0.972, high: 0.979, low: 0.915, preClose: 0.972, size: 75, ytd: 2.1, ytd1m: -5.3, maxDD: -30.5, manager: "唐屹", established: "2023-08-31", topHoldings: ["百济神州","睿创微纳","中科飞测","华恒生物","厦钨新能","珠海冠宇","孚能科技","绿的谐波","铂力特","芯动联科"], trackingIndex: { name: "科创100", code: "000698", changePct: -5.3 }, news: [ { date: "2026-07-17", title: "科创100中小市值弹性大, 跟随调整", source: "东方财富", impact: "负面" }, { date: "2026-07-08", title: "科创100成分股研发投入同比+22%", source: "证券时报", impact: "正面" } ] },
  { code: "sh588240", name: "科创200ETF", provider: "华泰柏瑞", fullCode: "588240", price: 1.180, changePct: -5.8, open: 1.253, high: 1.260, low: 1.174, preClose: 1.253, size: 30, ytd: -3.2, ytd1m: -5.8, maxDD: -33.0, manager: "李沐阳", established: "2024-01-12", topHoldings: ["裕太微","龙芯中科","丛麟科技","英科再生","国力股份","必易微","芯碁微装","安路科技","晶合集成","翱捷科技"], trackingIndex: { name: "科创200", code: "000699", changePct: -5.8 }, news: [ { date: "2026-07-17", title: "科创200小盘成长波动加大", source: "东方财富", impact: "负面" }, { date: "2026-07-05", title: "科创200新质生产力含量提升", source: "中国证券报", impact: "正面" } ] },
  { code: "sh588110", name: "科创成长ETF", provider: "易方达", fullCode: "588110", price: 1.020, changePct: -5.0, open: 1.074, high: 1.081, low: 1.015, preClose: 1.074, size: 18, ytd: 6.0, ytd1m: -5.0, maxDD: -29.0, manager: "成曦", established: "2023-07-21", topHoldings: ["中芯国际","海光信息","中微公司","金山办公","寒武纪","传音控股","澜起科技","联影医疗","拓荆科技","芯源微"], trackingIndex: { name: "科创成长", code: "000690", changePct: -5.0 }, news: [ { date: "2026-07-17", title: "科创成长高弹性品种随市回调", source: "证券时报", impact: "负面" }, { date: "2026-07-09", title: "科创成长指数调入多只AI龙头", source: "中证指数公司", impact: "正面" } ] },
  { code: "sh588400", name: "科创创业50ETF", provider: "嘉实", fullCode: "588400", price: 0.680, changePct: -4.6, open: 0.713, high: 0.719, low: 0.676, preClose: 0.713, size: 42, ytd: 4.5, ytd1m: -4.6, maxDD: -26.5, manager: "张钟玉", established: "2021-07-05", topHoldings: ["宁德时代","迈瑞医疗","中芯国际","海光信息","汇川技术","阳光电源","中微公司","金山办公","寒武纪","亿纬锂能"], trackingIndex: { name: "科创创业50", code: "931643", changePct: -4.6 }, news: [ { date: "2026-07-17", title: "科创创业50新能源+半导体双主线调整", source: "东方财富", impact: "负面" }, { date: "2026-07-11", title: "科创创业50权重股中报高增预告", source: "中国证券报", impact: "正面" } ] },
  { code: "sh510300", name: "沪深300ETF", provider: "华泰柏瑞", fullCode: "510300", price: 3.850, changePct: -2.1, open: 3.932, high: 3.945, low: 3.838, preClose: 3.932, size: 2800, ytd: 5.2, ytd1m: -2.1, maxDD: -12.0, manager: "柳军", established: "2012-05-04", topHoldings: ["贵州茅台","宁德时代","中国平安","招商银行","美的集团","长江电力","兴业银行","比亚迪","紫金矿业","东方财富"], trackingIndex: { name: "沪深300", code: "000300", changePct: -2.1 }, news: [ { date: "2026-07-17", title: "沪深300蓝筹抗跌, 保险银行护盘", source: "上海证券报", impact: "中性" }, { date: "2026-07-12", title: "沪深300股息率回升至3%以上", source: "证券时报", impact: "正面" } ] },
  { code: "sh510500", name: "中证500ETF", provider: "南方", fullCode: "510500", price: 6.120, changePct: -2.8, open: 6.296, high: 6.310, low: 6.098, preClose: 6.296, size: 1100, ytd: 3.1, ytd1m: -2.8, maxDD: -16.5, manager: "罗文杰", established: "2013-02-06", topHoldings: ["新易盛","沪电股份","中际旭创","天孚通信","润和软件","思源电气","华工科技","东山精密","水晶光电","渤海租赁"], trackingIndex: { name: "中证500", code: "000905", changePct: -2.8 }, news: [ { date: "2026-07-17", title: "中证500中盘制造链跟随调整", source: "东方财富", impact: "负面" }, { date: "2026-07-06", title: "中证500成分股回购金额创年内新高", source: "中国证券报", impact: "正面" } ] },
  { code: "sh512100", name: "中证1000ETF", provider: "南方", fullCode: "512100", price: 2.480, changePct: -3.2, open: 2.562, high: 2.568, low: 2.470, preClose: 2.562, size: 280, ytd: 1.5, ytd1m: -3.2, maxDD: -19.0, manager: "崔蕾", established: "2016-09-29", topHoldings: ["欧菲光","兴森科技","赢合科技","沃尔核材","麦格米特","招商南油","恒玄科技","上海贝岭","锐捷网络","荣昌生物"], trackingIndex: { name: "中证1000", code: "000852", changePct: -3.2 }, news: [ { date: "2026-07-17", title: "中证1000小盘承压, 流动性偏紧", source: "东方财富", impact: "负面" }, { date: "2026-07-04", title: "中证1000专精特新含量居前", source: "证券时报", impact: "正面" } ] },
  { code: "sh510050", name: "上证50ETF", provider: "华夏", fullCode: "510050", price: 2.620, changePct: -1.6, open: 2.663, high: 2.668, low: 2.612, preClose: 2.663, size: 1500, ytd: 6.8, ytd1m: -1.6, maxDD: -10.5, manager: "张弘弢", established: "2004-12-30", topHoldings: ["贵州茅台","中国平安","招商银行","长江电力","兴业银行","中信证券","工商银行","恒瑞医药","紫金矿业","伊利股份"], trackingIndex: { name: "上证50", code: "000016", changePct: -1.6 }, news: [ { date: "2026-07-17", title: "上证50权重护盘, 跌幅最小", source: "上海证券报", impact: "中性" }, { date: "2026-07-10", title: "上证50高股息防御属性凸显", source: "中国证券报", impact: "正面" } ] },
  { code: "sz159915", name: "创业板ETF", provider: "易方达", fullCode: "159915", price: 1.980, changePct: -3.5, open: 2.052, high: 2.058, low: 1.973, preClose: 2.052, size: 900, ytd: 2.0, ytd1m: -3.5, maxDD: -20.0, manager: "成曦", established: "2011-09-20", topHoldings: ["宁德时代","东方财富","迈瑞医疗","阳光电源","汇川技术","新易盛","亿纬锂能","爱尔眼科","三环集团","蓝思科技"], trackingIndex: { name: "创业板指", code: "399006", changePct: -3.5 }, news: [ { date: "2026-07-17", title: "创业板指新能源权重拖累", source: "东方财富", impact: "负面" }, { date: "2026-07-09", title: "创业板注册制改革预期升温", source: "证券时报", impact: "正面" } ] },
  { code: "sh515080", name: "中证红利ETF", provider: "招商", fullCode: "515080", price: 1.420, changePct: -0.8, open: 1.431, high: 1.434, low: 1.416, preClose: 1.431, size: 180, ytd: 9.5, ytd1m: -0.8, maxDD: -8.5, manager: "王平", established: "2019-11-28", topHoldings: ["中国神华","陕西煤业","唐山港","格力电器","钓鱼台","大秦铁路","美的集团","双汇发展","海澜之家","中文传媒"], trackingIndex: { name: "中证红利", code: "000922", changePct: -0.8 }, news: [ { date: "2026-07-17", title: "中证红利防御属性强, 逆势抗跌", source: "上海证券报", impact: "正面" }, { date: "2026-07-13", title: "红利资产获险资持续增配", source: "中国证券报", impact: "正面" } ] }
];

(function buildSeedEtfs() {
  SEED_NEW_ETFS.forEach(s => {
    if (QUOTE_DATA[s.code]) return; // 自动化已写入真实数据则保留，不覆盖
    const rng = _mulberry32(_hashStr(s.code));
    QUOTE_DATA[s.code] = {
      name: s.name, price: s.price, change: +(s.price - s.preClose).toFixed(3), changePct: s.changePct,
      open: s.open, high: s.high, low: s.low, preClose: s.preClose,
      volume: Math.floor(8_000_000 + rng() * 6_000_000), turnover: Math.floor(s.size * 1_000_000 * (0.01 + rng() * 0.02)),
      amount: Math.floor(s.price * s.size * 1_000_000 * (0.01 + rng() * 0.02)), marketCap: s.size
    };
    ETF_DETAIL[s.code] = { nav: s.price, accNav: s.price, premiumRate: 0, size: s.size, yieldYtd: s.ytd, yield1m: s.ytd1m, maxDrawdown: s.maxDD, manager: s.manager, established: s.established, topHoldings: s.topHoldings };
    const mni = +((s.changePct / 10) * s.size * 0.02).toFixed(2);
    FUND_FLOW[s.code] = {
      mainNetInflow: mni, mainInflow: +(Math.abs(mni) * 1.3 + 0.2).toFixed(2), mainOutflow: +(Math.abs(mni) * 0.7 + 0.1).toFixed(2),
      retailNetInflow: -mni, superLargeNet: +(mni * 0.6).toFixed(2), largeNet: +(mni * 0.4).toFixed(2), mediumNet: +(mni * 0.2).toFixed(2), smallNet: +(-mni * 0.2).toFixed(2)
    };
    const pcfTop = s.topHoldings.slice(0, 5).map((h, i) => [h, +(12 - i * 1.5).toFixed(1)]);
    ETF_SPECIFIC[s.code] = {
      totalShares: s.size, circulationShares: s.size, shareChangePct: QUARTERLY_DATA[s.code].aumChangePct,
      pcf: pcfTop, premiumRate: 0, premiumDeviation: 0, marginBalance: MARGIN_DATA[s.code].balance, marginLending: MARGIN_DATA[s.code].lending, trackingIndex: s.trackingIndex
    };
    NEWS_DATA[s.code] = s.news;
  });
})();

// =====================================================================
// 10. 盘口五档 / IOPV / 逐笔 (全部18只, 4时点快照)
// =====================================================================
const ORDER_BOOK = {};
ALL_CODES.forEach(code => {
  const q = QUOTE_DATA[code];
  const tick = (q.price < 1) ? 0.001 : 0.01;
  const baseVol = Math.floor(q.volume / 1200);
  const rng = _mulberry32(_hashStr(code + "ob"));
  const bids = [], asks = [];
  for (let i = 1; i <= 5; i++) {
    bids.push({ price: +(q.price - i * tick).toFixed(3), vol: Math.floor(baseVol * (1 + rng() * 0.4) * (6 - i) / 3) });
    asks.push({ price: +(q.price + i * tick).toFixed(3), vol: Math.floor(baseVol * (1 + rng() * 0.4) * (6 - i) / 3) });
  }
  ORDER_BOOK[code] = {
    bids, asks,
    internalVol: Math.floor(q.volume * 0.42), externalVol: Math.floor(q.volume * 0.58),
    volumeRatio: +(0.8 + rng() * 0.6).toFixed(2),
    amplitude: +Math.abs((q.high - q.low) / q.preClose * 100).toFixed(2),
    turnoverRate: +(q.turnover / 10000 / q.marketCap * 100).toFixed(2),
    _realtime: false
  };
});

const IOPV_DATA = {};
ALL_CODES.forEach(code => {
  const d = ETF_DETAIL[code];
  const q = QUOTE_DATA[code];
  const iopv = +d.nav.toFixed(4);
  const premiumRate = +(((q.price - iopv) / iopv) * 100).toFixed(3);
  IOPV_DATA[code] = {
    iopv, nav: d.nav, premiumRate, premiumDeviation: +Math.abs(premiumRate).toFixed(3),
    arbitrageSpace: Math.abs(premiumRate) > THRESHOLDS.shortTerm.premium.arb, _realtime: false
  };
});

const TICK_DATA = {};
ALL_CODES.forEach(code => {
  const f = FUND_FLOW[code];
  TICK_DATA[code] = {
    activeBuy: +(f.mainInflow * 0.6 + f.retailNetInflow * 0.4).toFixed(2),
    activeSell: +(f.mainOutflow * 0.6 + f.retailNetInflow * 0.3).toFixed(2),
    netInflow: f.mainNetInflow, tradeCount: Math.floor(QUOTE_DATA[code].volume / 100), _realtime: false
  };
});

// =====================================================================
// 11. K线 (前复权, 确定性生成) + 多周期
// =====================================================================
function generateKlineData(code) {
  const quote = QUOTE_DATA[code];
  const detail = ETF_DETAIL[code];
  const rng = _mulberry32(_hashStr(code + "kline"));
  const basePrice = quote.preClose;
  const ytdReturn = detail.yieldYtd / 100;
  const startPrice = basePrice / (1 + ytdReturn / 365 * 120);
  const data = [];
  const days = 120;
  let price = startPrice;
  const volatility = code === "sh513310" ? 0.025 : code === "sz159516" ? 0.022 : 0.018;
  const trendSlope = ytdReturn / days * 0.3;
  let phase = 0;
  const phaseLength = Math.floor(days * 0.6);
  for (let i = days; i >= 0; i--) {
    const date = new Date(2026, 6, 17);
    date.setDate(date.getDate() - i);
    if (i < days - phaseLength) phase = 1;
    const trend = phase === 0 ? trendSlope : -trendSlope * 0.8;
    const random = (rng() - 0.5) * volatility;
    const changePct = trend + random;
    const open = price;
    const close = price * (1 + changePct);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - rng() * volatility * 0.5);
    const volume = Math.floor(quote.volume * (0.3 + rng() * 0.7) / days);
    if (i === 0) {
      data.push({ date: "2026-07-17", open: quote.open, high: quote.high, low: quote.low, close: quote.price, volume: quote.volume, amount: quote.amount });
    } else {
      data.push({ date: date.toISOString().split("T")[0], open: +open.toFixed(3), high: +high.toFixed(3), low: +low.toFixed(3), close: +close.toFixed(3), volume, amount: Math.floor(volume * close) });
    }
    price = i === 0 ? quote.price : close;
  }
  return data;
}
const KLINE_DATA = {};
ALL_CODES.forEach(code => { if (!KLINE_DATA[code]) KLINE_DATA[code] = generateKlineData(code); });

function aggregateIntraday(daily, periodMin) {
  const bars = Math.floor(240 / periodMin);
  const out = [];
  const d = daily[daily.length - 1];
  const seg = (d.high - d.low) / bars;
  for (let i = 0; i < bars; i++) {
    const open = d.low + seg * i + (Math.random() - 0.5) * seg * 0.5;
    const close = d.low + seg * (i + 1) + (Math.random() - 0.5) * seg * 0.5;
    out.push({ ts: `2026-07-17 ${9 + Math.floor(i * periodMin / 60)}:${String((i * periodMin) % 60).padStart(2, "0")}`, open: +open.toFixed(3), high: +Math.max(open, close).toFixed(3), low: +Math.min(open, close).toFixed(3), close: +close.toFixed(3), volume: Math.floor(d.volume / bars), amount: Math.floor(d.amount / bars) });
  }
  return out;
}
function aggregatePeriod(daily, type) {
  const step = type === "week" ? 5 : 20;
  const out = [];
  for (let i = 0; i < daily.length; i += step) {
    const slice = daily.slice(i, i + step);
    if (!slice.length) break;
    const open = slice[0].open, close = slice[slice.length - 1].close;
    const high = Math.max(...slice.map(x => x.high)), low = Math.min(...slice.map(x => x.low));
    const volume = slice.reduce((s, x) => s + x.volume, 0), amount = slice.reduce((s, x) => s + (x.amount || 0), 0);
    const prevClose = i === 0 ? slice[0].open : daily[i - 1].close;
    out.push({ date: slice[slice.length - 1].date, open: +open.toFixed(3), high: +high.toFixed(3), low: +low.toFixed(3), close: +close.toFixed(3), volume, amount, changePct: +(((close - prevClose) / prevClose) * 100).toFixed(2) });
  }
  return out;
}
const KLINE_MULTI = {};
ALL_CODES.forEach(code => {
  const daily = KLINE_DATA[code];
  const k1 = [{ ts: "2026-07-17 15:00", open: QUOTE_DATA[code].open, high: QUOTE_DATA[code].high, low: QUOTE_DATA[code].low, close: QUOTE_DATA[code].price, volume: QUOTE_DATA[code].volume, amount: QUOTE_DATA[code].amount }];
  KLINE_MULTI[code] = { min1: k1, min5: aggregateIntraday(daily, 5), min15: aggregateIntraday(daily, 15), min30: aggregateIntraday(daily, 30), min60: aggregateIntraday(daily, 60), daily, weekly: aggregatePeriod(daily, "week"), monthly: aggregatePeriod(daily, "month") };
});

// =====================================================================
// 12. 宏观 & 板块对照 (扩展基准指数)
// =====================================================================
const MACRO_SECTOR = {
  asOf: "2026-07-17",
  sector: {},
  benchmark: {
    csi300:   { name: "沪深300", code: "000300", changePct: -2.1, close: 3582.4 },
    csi500:   { name: "中证500", code: "000905", changePct: -2.8, close: 5421.6 },
    csi1000:  { name: "中证1000", code: "000852", changePct: -3.2, close: 5987.3 },
    sse50:    { name: "上证50", code: "000016", changePct: -1.6, close: 2589.1 },
    chinext:  { name: "创业板指", code: "399006", changePct: -3.5, close: 1987.3 },
    star50:   { name: "科创50", code: "000688", changePct: -4.8, close: 987.6 },
    csiDividend: { name: "中证红利", code: "000922", changePct: -0.8, close: 5321.8 }
  },
  sentiment: { totalTurnover: 11860.5, upCount: 612, downCount: 4583, flatCount: 47, limitUp: 38, limitDown: 142 },
  macroCatalyst: [
    { date: "2026-07-15", item: "央行MLF续作, 利率维持2.3%", impact: "中性" },
    { date: "2026-07-10", item: "大基金三期向半导体设备注资落地", impact: "正面" },
    { date: "2026-07-05", item: "美国对华半导体出口管制加码", impact: "负面" },
    { date: "2026-06-30", item: "特高压2026投资规划超600亿", impact: "正面" }
  ]
};
// 各ETF所属板块(用于板块对照)
const SECTOR_MAP = {
  sh513310: { name: "半导体", changePct: -9.8, turnover: 1280.5, fundFlow: -86.2 },
  sh515880: { name: "通信设备", changePct: -4.5, turnover: 645.3, fundFlow: -32.1 },
  sh516510: { name: "云计算", changePct: -5.0, turnover: 412.8, fundFlow: -18.7 },
  sh588200: { name: "科创芯片", changePct: -5.1, turnover: 538.2, fundFlow: -41.5 },
  sz159326: { name: "电网设备", changePct: -4.6, turnover: 286.4, fundFlow: -9.3 },
  sz159516: { name: "半导体设备", changePct: -5.0, turnover: 398.7, fundFlow: -28.4 },
  sz159732: { name: "消费电子", changePct: -4.3, turnover: 521.9, fundFlow: -22.8 },
  sh588000: { name: "科创50", changePct: -4.8, turnover: 980.2, fundFlow: -62.1 },
  sh588030: { name: "科创100", changePct: -5.3, turnover: 420.5, fundFlow: -28.4 },
  sh588240: { name: "科创200", changePct: -5.8, turnover: 210.3, fundFlow: -14.2 },
  sh588110: { name: "科创成长", changePct: -5.0, turnover: 180.6, fundFlow: -11.8 },
  sh588400: { name: "科创创业50", changePct: -4.6, turnover: 320.4, fundFlow: -20.5 },
  sh510300: { name: "沪深300", changePct: -2.1, turnover: 2100.5, fundFlow: -58.2 },
  sh510500: { name: "中证500", changePct: -2.8, turnover: 1380.3, fundFlow: -42.1 },
  sh512100: { name: "中证1000", changePct: -3.2, turnover: 1120.8, fundFlow: -38.5 },
  sh510050: { name: "上证50", changePct: -1.6, turnover: 980.4, fundFlow: -22.3 },
  sz159915: { name: "创业板指", changePct: -3.5, turnover: 1620.7, fundFlow: -52.4 },
  sh515080: { name: "中证红利", changePct: -0.8, turnover: 320.1, fundFlow: -4.2 }
};

// =====================================================================
// 13. 4时点更新节奏 (13:31 修正)
// =====================================================================
const UPDATE_SCHEDULE = [
  { cadence: "① 09:31 开盘快照", window: "交易日 09:31", freq: "每交易日1次", items: ["基本面","技术面","消息面","资金面","两融","北向","估值","季报"], method: "WorkBuddy自动化: westock-data采集→更新data.js→推送GitHub", source: "腾讯自选股 + 综合分析模型" },
  { cadence: "② 11:31 午盘快照", window: "交易日 11:31", freq: "每交易日1次", items: ["基本面","技术面","消息面","资金面(半日)","两融","北向","估值"], method: "WorkBuddy自动化", source: "腾讯自选股 + 综合分析模型" },
  { cadence: "③ 13:31 午后快照", window: "交易日 13:31", freq: "每交易日1次", items: ["基本面","技术面","消息面","资金面","两融","北向","估值"], method: "WorkBuddy自动化", source: "腾讯自选股 + 综合分析模型" },
  { cadence: "④ 16:00 收盘快照", window: "交易日 16:00", freq: "每交易日1次", items: ["基本面","技术面(完整日线)","消息面","资金面(全日)","两融","北向","估值","季报"], method: "WorkBuddy自动化", source: "腾讯自选股 + 综合分析模型" }
];

const DATA_TIMESTAMP = "2026-07-17 15:00:00 (收盘快照, 盘中4时点自动刷新)";
const DATA_SOURCE = "腾讯自选股行情数据接口 + 综合分析模型";

// ETF 元信息(名称/代码/管理人) — 供分组导航与详情使用
const ETF_META = {};
ALL_CODES.forEach(code => {
  const q = QUOTE_DATA[code];
  const sp = SEED_NEW_ETFS.find(s => s.code === code);
  const holdingMeta = [
    { code: "sh513310", provider: "华泰柏瑞", fullCode: "513310" }, { code: "sh515880", provider: "国泰", fullCode: "515880" },
    { code: "sh516510", provider: "易方达", fullCode: "516510" }, { code: "sh588200", provider: "嘉实", fullCode: "588200" },
    { code: "sz159326", provider: "华夏", fullCode: "159326" }, { code: "sz159516", provider: "国泰", fullCode: "159516" },
    { code: "sz159732", provider: "华夏", fullCode: "159732" }
  ].find(m => m.code === code);
  ETF_META[code] = { code, name: q.name, fullCode: sp ? sp.fullCode : holdingMeta.fullCode, provider: sp ? sp.provider : holdingMeta.provider };
});

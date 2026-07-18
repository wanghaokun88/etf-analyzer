// ETF 技术指标计算引擎
// 从K线数据计算 MACD、RSI、KDJ、布林带、均线等

const TechnicalEngine = {

  // ========== 均线系统 ==========
  calculateMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close;
        }
        result.push(sum / period);
      }
    }
    return result;
  },

  // ========== MACD ==========
  calculateEMA(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  },

  calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const closes = data.map(d => d.close);
    const emaShort = this.calculateEMA(closes, shortPeriod);
    const emaLong = this.calculateEMA(closes, longPeriod);
    const dif = emaShort.map((v, i) => v - emaLong[i]);
    const dea = this.calculateEMA(dif, signalPeriod);
    const macd = dif.map((v, i) => (v - dea[i]) * 2);

    return { dif, dea, macd };
  },

  // ========== RSI ==========
  calculateRSI(data, period = 14) {
    const result = [];
    let gains = 0, losses = 0;

    for (let i = 0; i < period; i++) {
      result.push(null);
      if (i > 0) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
    return result;
  },

  // ========== KDJ ==========
  calculateKDJ(data, period = 9, kSmooth = 3, dSmooth = 3) {
    const kValues = [], dValues = [], jValues = [];
    let prevK = 50, prevD = 50;

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        kValues.push(50);
        dValues.push(50);
        jValues.push(50);
        continue;
      }

      let highest = -Infinity, lowest = Infinity;
      for (let j = 0; j < period; j++) {
        highest = Math.max(highest, data[i - j].high);
        lowest = Math.min(lowest, data[i - j].low);
      }

      const rsv = highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100;
      const k = (2 / 3) * prevK + (1 / 3) * rsv;
      const d = (2 / 3) * prevD + (1 / 3) * k;
      const j = 3 * k - 2 * d;

      kValues.push(k);
      dValues.push(d);
      jValues.push(j);
      prevK = k;
      prevD = d;
    }
    return { k: kValues, d: dValues, j: jValues };
  },

  // ========== 布林带 ==========
  calculateBollinger(data, period = 20, multiplier = 2) {
    const ma = this.calculateMA(data, period);
    const upper = [], middle = [], lower = [];

    for (let i = 0; i < data.length; i++) {
      middle.push(ma[i]);
      if (i < period - 1 || ma[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        let sumSq = 0;
        for (let j = 0; j < period; j++) {
          sumSq += Math.pow(data[i - j].close - ma[i], 2);
        }
        const stdDev = Math.sqrt(sumSq / period);
        upper.push(ma[i] + multiplier * stdDev);
        lower.push(ma[i] - multiplier * stdDev);
      }
    }
    return { upper, middle, lower };
  },

  // ========== 量能分析 ==========
  calculateVolumeRatio(data, period = 5) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        result.push(1);
        continue;
      }
      let avgVol = 0;
      for (let j = 0; j < period; j++) {
        avgVol += data[i - j - 1].volume;
      }
      avgVol /= period;
      result.push(data[i].volume / avgVol);
    }
    return result;
  },

  // ========== 综合技术信号判断 ==========
  getTechnicalSignals(code) {
    const kline = KLINE_DATA[code];
    if (!kline || kline.length < 30) return null;

    const macd = this.calculateMACD(kline);
    const rsi = this.calculateRSI(kline);
    const kdj = this.calculateKDJ(kline);
    const boll = this.calculateBollinger(kline);
    const ma5 = this.calculateMA(kline, 5);
    const ma10 = this.calculateMA(kline, 10);
    const ma20 = this.calculateMA(kline, 20);
    const ma60 = this.calculateMA(kline, 60);
    const volRatio = this.calculateVolumeRatio(kline);

    const last = kline.length - 1;
    const prev = last - 1;

    const signals = {
      // MACD信号
      macdCross: macd.dif[last] > macd.dea[last] ? "金叉" : "死叉",
      macdTrend: macd.macd[last] > macd.macd[prev] ? "绿柱缩窄" : "绿柱放大/红柱放大",
      macdDif: macd.dif[last],
      macdDea: macd.dea[last],
      macdBar: macd.macd[last],

      // RSI信号
      rsiValue: rsi[last],
      rsiZone: rsi[last] > 70 ? "超买" : rsi[last] < 30 ? "超卖" : rsi[last] < 45 ? "偏弱" : rsi[last] > 55 ? "偏强" : "中性",

      // KDJ信号
      kdjK: kdj.k[last],
      kdjD: kdj.d[last],
      kdjJ: kdj.j[last],
      kdjCross: kdj.k[last] > kdj.d[last] ? "金叉" : "死叉",
      kdjTrend: kdj.k[last] > kdj.k[prev] ? "上行" : "下行",

      // 均线系统
      ma5: ma5[last],
      ma10: ma10[last],
      ma20: ma20[last],
      ma60: ma60[last],
      maAlignment: this._getMAAlignment(ma5, ma10, ma20, ma60, last),
      priceVsMA20: kline[last].close > ma20[last] ? "线上(多头)" : "线下(空头)",
      ma5vs10: ma5[last] > ma10[last] ? "多头排列" : "空头排列",

      // 布林带
      bollUpper: boll.upper[last],
      bollMiddle: boll.middle[last],
      bollLower: boll.lower[last],
      bollPosition: this._getBollPosition(kline[last].close, boll, last),
      bollWidth: boll.upper[last] && boll.lower[last] ? (boll.upper[last] - boll.lower[last]) / boll.middle[last] : null,

      // 量能
      volRatio: volRatio[last],
      volTrend: volRatio[last] > 1.5 ? "放量" : volRatio[last] < 0.7 ? "缩量" : "正常",
      priceVolRelation: this._getPriceVolRelation(kline, volRatio, last),

      // 综合评分
      totalScore: this._calculateTotalScore(macd, rsi, kdj, boll, ma5, ma10, ma20, kline, volRatio, last),
    };

    return signals;
  },

  _getMAAlignment(ma5, ma10, ma20, ma60, idx) {
    if (!ma5[idx] || !ma10[idx] || !ma20[idx] || !ma60[idx]) return "数据不足";
    if (ma5[idx] > ma10[idx] && ma10[idx] > ma20[idx] && ma20[idx] > ma60[idx]) return "完美多头排列";
    if (ma5[idx] < ma10[idx] && ma10[idx] < ma20[idx] && ma20[idx] < ma60[idx]) return "完美空头排列";
    if (ma5[idx] > ma10[idx] && ma10[idx] > ma20[idx]) return "短期多头";
    if (ma5[idx] < ma10[idx] && ma10[idx] < ma20[idx]) return "短期空头";
    return "均线交织";
  },

  _getBollPosition(price, boll, idx) {
    if (!boll.upper[idx] || !boll.lower[idx]) return "数据不足";
    const range = boll.upper[idx] - boll.lower[idx];
    if (range === 0) return "异常";
    const position = (price - boll.lower[idx]) / range;
    if (position > 0.95) return "触及上轨(超买区)";
    if (position < 0.05) return "触及下轨(超卖区)";
    if (position > 0.7) return "上轨附近(偏强)";
    if (position < 0.3) return "下轨附近(偏弱)";
    return "中轨附近(中性)";
  },

  _getPriceVolRelation(kline, volRatio, idx) {
    const prevIdx = idx - 1;
    if (prevIdx < 0) return "数据不足";
    const priceUp = kline[idx].close > kline[prevIdx].close;
    const volUp = volRatio[idx] > 1;

    if (priceUp && volUp) return "量价齐升(健康上涨)";
    if (priceUp && !volUp) return "价涨量缩(上涨乏力)";
    if (!priceUp && volUp) return "放量下跌(抛压重)";
    if (!priceUp && !volUp) return "缩量下跌(调整温和)";
    return "中性";
  },

  _calculateTotalScore(macd, rsi, kdj, boll, ma5, ma10, ma20, kline, volRatio, idx) {
    let score = 50; // 基础分

    // MACD (权重 25%)
    if (macd.dif[idx] > macd.dea[idx]) score += 12; // 金叉加分
    else score -= 12;
    if (macd.macd[idx] > 0) score += 5;
    else score -= 5;

    // RSI (权重 20%)
    if (rsi[idx] > 60) score += 10;
    else if (rsi[idx] > 50) score += 5;
    else if (rsi[idx] < 30) score -= 10;
    else if (rsi[idx] < 40) score -= 5;

    // KDJ (权重 15%)
    if (kdj.k[idx] > kdj.d[idx]) score += 7;
    else score -= 7;
    if (kdj.j[idx] > 80) score -= 3; // 超买扣分
    else if (kdj.j[idx] < 20) score += 3; // 超卖加分

    // 均线 (权重 20%)
    if (ma5[idx] > ma10[idx]) score += 5;
    else score -= 5;
    if (kline[idx].close > ma20[idx]) score += 5;
    else score -= 5;

    // 布林带 (权重 10%)
    if (boll.middle[idx] && kline[idx].close > boll.middle[idx]) score += 5;
    else if (boll.middle[idx]) score -= 5;

    // 量能 (权重 10%)
    if (volRatio[idx] > 1 && kline[idx].close > kline[idx - 1]?.close) score += 5;
    else if (volRatio[idx] > 1.5 && kline[idx].close < kline[idx - 1]?.close) score -= 5;

    return Math.max(0, Math.min(100, score));
  }
};

# ETF 多维度分析仪表盘

> 仓库地址：https://gitee.com/wang-haokun6688/etf-analyzer

## 项目文件结构
```
etf-analyzer/
├── index.html      # 主页面
├── style.css       # 样式文件
├── data.js         # ETF数据集（行情/详情/资金流/新闻/分析结论）
├── technical.js    # 技术指标计算引擎（MACD/RSI/KDJ/布林带/均线）
├── app.js          # 主应用逻辑（渲染/图表/交互）
└── README.md       # 本文件
```

## 网站访问

代码已推送至 Gitee。启用 Pages 后访问地址为：
`https://wang-haokun6688.gitee.io/etf-analyzer`

## 启用 Gitee Pages（还需手动操作）

由于 Gitee 要求账号安全评级达标才能公开仓库，你需要先完成以下步骤：

1. **提升账号安全评级**：登录 Gitee → 右上角头像 → 设置 → 绑定第三方账号（QQ/微信/钉钉等）或开启 2FA
2. **设置仓库为公开**：进入仓库 https://gitee.com/wang-haokun6688/etf-analyzer → 设置 → 公开
3. **启用 Pages 服务**：进入仓库 → 服务 → Gitee Pages → 分支 master → 目录 / → 启动

## 数据自动更新

已配置 WorkBuddy 定时自动化（每天 8:30 开盘前），自动刷新7只ETF数据并推送更新。

## 跟踪的 ETF（7只）

| 代码 | 名称 | 板块 |
|------|------|------|
| sh513310 | 中韩半导体ETF | 半导体 |
| sh515880 | 通信ETF | 通信 |
| sh516510 | 云计算ETF | 云计算 |
| sh588200 | 科创芯片ETF | 科创芯片 |
| sz159326 | 电网设备ETF | 电网设备 |
| sz159516 | 半导体设备ETF | 半导体设备 |
| sz159732 | 消电子ETF | 消费电子 |

## 技术特性

- **纯前端**：HTML + CSS + JavaScript，无需后端服务器
- **技术指标计算**：MACD、RSI、KDJ、布林带、均线全部客户端实时计算
- **五维评分体系**：基本面/技术面/消息面/资金面/量能综合评分
- **走势预测**：短期(1-2周)和长期(1-3月)趋势判断
- **关键价位**：支撑位和压力位三级标注
- **交互式图表**：Chart.js 渲染6类图表
- **中国股市颜色约定**：涨=红色，跌=绿色

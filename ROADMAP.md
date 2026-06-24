# 路路辣评 (Road Roast) — 产品路线图

> 最后更新：2026-06-23

---

## 已完成

### 2026-06-23 — 安全加固 + 功能修复 + 性能优化 + 体验优化

详见 [changelog-2026-06-23.md](docs/changelog-2026-06-23.md)

**安全加固**
- API Key+Secret 迁移至云开发环境变量，前端不再暴露密钥
- 5 个云函数补齐 openid 身份校验
- user-info 更新昵称增加 msgSecCheck 内容安全检测

**功能修复**
- ticket-create 中 DailyLimit 创建移到内容安全检测之后，检测失败不再留下脏数据
- User.totalTickets 与 Ticket 计数同步，user-info 去掉冗余 count 查询

**性能优化**
- road-ranking 周期榜从 500 条内存分组改为聚合管道，数据准确无上限
- ticket-create 内容安全检测与用户信息查询并行执行
- 创建 Ticket/Road 关键复合索引

**体验优化**
- callFunction 增加 15 秒超时控制 + loading 引用计数
- 排行榜"我的城市"定位失败降级提示
- 路段详情页内嵌贴罚单面板，不再跳回首页
- share-canvas 分享图生成增加 loading 指示

### 2026-06-23 — 强制授权登录

**改动**
- 首次使用小程序时弹出授权弹窗，必须选择头像+填写昵称
- 头像上传至云存储，昵称写入 User 表
- 已授权用户直接进入，不再弹窗

**涉及文件**
- `app.js` — 启动检查授权状态
- `utils/auth.js` — 新增 checkAuth()
- `pages/index/` — 授权弹窗 UI + 逻辑

### 2026-06-23 — 时间格式化

**改动**
- ticket-list 和 road-detail 的 formatTime 统一为相对时间格式（刚刚/X分钟前/X小时前/X天前/具体日期）
- road-detail 的 formatTime 增加 isNaN 校验

**涉及文件**
- `cloudfunctions/ticket-list/index.js`
- `cloudfunctions/road-detail/index.js`

---

## 近期（上线前）

- [ ] 真机测试：完整流程验证
- [ ] 边界场景测试：弱网、定位拒绝、连续操作、特殊字符
- [ ] 确认 msgSecCheck 内容安全接口已开通
- [ ] 生成 default-avatar.png 默认头像

---

### 2026-06-23 — P2 UX 问题修复

**改动**
- 首页增加地图加载骨架屏，替代闪烁的"无法获取定位"降级页
- Marker 点击跳转路段详情（markerId 反查 road 数据）
- 搜索防抖从 300ms 调整为 500ms，增加 generation counter 竞态保护
- 搜索失败时 toast 提示（之前静默吞错）
- safeNavigate 封装，页面栈接近上限时用 redirectTo 替代

**涉及文件**
- `pages/index/index.js` — 骨架屏、Marker 点击、搜索竞态保护
- `pages/index/index.wxml` — 骨架屏 UI
- `pages/index/index.wxss` — 骨架屏样式
- `pages/ranking/ranking.js` — safeNavigate
- `pages/profile/profile.js` — safeNavigate
- `utils/cloud.js` — safeNavigate 封装

### 2026-06-23 — 朋友圈原生分享

**改动**
- 首页和路段详情页增加 `onShareTimeline` 生命周期，支持右上角菜单分享到朋友圈

**涉及文件**
- `pages/index/index.js`
- `pages/road-detail/road-detail.js`

### 2026-06-23 — 数据埋点

**改动**
- 新增 analytics 云函数，写入 Analytics 集合
- cloud.js 封装 trackEvent()，异步调用不阻塞主流程
- 首页：搜索、贴罚单、分享事件埋点
- 路段详情：贴罚单、分享事件埋点

**涉及文件**
- `cloudfunctions/analytics/` — 新增埋点云函数
- `utils/cloud.js` — trackEvent 封装
- `pages/index/index.js` — 搜索/贴罚单/分享埋点
- `pages/road-detail/road-detail.js` — 贴罚单/分享埋点

---

## 中期（上线后迭代）

- [x] P2 UX 问题修复：首页骨架屏、时间格式化、Marker 点击交互、页面栈溢出防护
- [x] 朋友圈原生分享：增加 onShareTimeline
- [x] 数据埋点：贴罚单数、搜索次数、分享次数
- [ ] geocoder/road-search 公共模块抽取（签名函数、formatTime）

---

## 长期（产品演进）

- [ ] 附近路段推荐：基于定位自动推荐周边可吐槽路段
- [ ] 用户排行榜：谁贴的罚单最多
- [ ] 消息通知：你吐槽的路段被跟帖时通知
- [ ] 罚单详情页：单条罚单的分享/互动
- [ ] 内容审核兜底：违规内容举报/处理机制

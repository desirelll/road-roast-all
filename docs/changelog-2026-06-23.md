# 路路辣评 上线前代码审查与优化记录

> 日期：2026-06-23
> 分支：main
> 提交：`076c29f` → `22c68e3`（共 4 次提交）

---

## 一、安全加固

### 1.1 API Key 迁移至环境变量

**问题：** 腾讯地图 API Key+Secret 硬编码在 geocoder、road-search 云函数源码中；前端 ranking.js 也直接暴露 Key。

**修改：**
- `cloudfunctions/geocoder/index.js` — Key+Secret 改为 `process.env.TENCENT_MAP_KEY` / `process.env.TENCENT_MAP_SK`
- `cloudfunctions/road-search/index.js` — 同上
- `pages/ranking/ranking.js` — `getUserCity()` 从直接调用腾讯地图 API 改为调用 geocoder 云函数

**部署操作：** 在云开发控制台 → 设置 → 环境变量中配置：
- `TENCENT_MAP_KEY`
- `TENCENT_MAP_SK`

### 1.2 云函数补齐 openid 身份校验

**问题：** 5 个云函数缺少 `cloud.getWXContext()` 身份校验，可被匿名无限调用。

**修改：** 以下云函数统一增加 openid 校验：
- `cloudfunctions/road-search/index.js`
- `cloudfunctions/road-ranking/index.js`
- `cloudfunctions/road-detail/index.js`
- `cloudfunctions/geocoder/index.js`
- `cloudfunctions/share-qrcode/index.js`

### 1.3 昵称内容安全检测

**问题：** `user-info` 更新昵称时未做 `msgSecCheck`，违规昵称可绕过安全检测。

**修改：** `cloudfunctions/user-info/index.js` — `updateUserInfo()` 中对 nickname 增加 `cloud.openapi.security.msgSecCheck` 检测。

---

## 二、功能 Bug 修复

### 2.1 DailyLimit 顺序修复

**问题：** `ticket-create` 执行顺序为：创建 DailyLimit → 内容安全检测 → 创建 Ticket。安全检测失败时 DailyLimit 已写入，用户修改评论重试会被"今天已贴过"拦截。

**修改：** `cloudfunctions/ticket-create/index.js` — 调整顺序为：内容安全检测 → 获取用户信息 → 创建 DailyLimit → 创建 Ticket。安全检测失败不会留下脏数据。

### 2.2 User.totalTickets 同步

**问题：** `User` 表有 `totalTickets` 字段但从未更新，`user-info` 每次通过 `Ticket.count()` 实时统计，性能差且数据源不一致。

**修改：**
- `cloudfunctions/ticket-create/index.js` — 贴罚单成功后并行更新 `Road.totalTickets` 和 `User.totalTickets`（`db.command.inc(1)`）
- `cloudfunctions/user-info/index.js` — `getUserInfo()` 直接读 `User.totalTickets`，去掉 `Ticket.count()` 查询

---

## 三、性能优化

### 3.1 周期榜改为聚合查询

**问题：** `road-ranking` 周期榜查询取 500 条 Ticket 到内存分组，数据量大时结果不准确。

**修改：** `cloudfunctions/road-ranking/index.js` — `periodRanking()` 改为数据库聚合管道 `aggregate().match().group().sort().lookup()`，在数据库层完成分组计数，无条数限制。

### 3.2 ticket-create 并行优化

**问题：** 内容安全检测和用户信息查询串行执行，多消耗 100-200ms。

**修改：** `cloudfunctions/ticket-create/index.js` — 两个操作改为 `Promise.all` 并行执行。

### 3.3 数据库索引

**操作：** 在云开发控制台创建以下索引：

| 集合 | 索引字段 | 用途 |
|------|---------|------|
| Ticket | `userId` (升序) + `createdAt` (降序) | 我的罚单列表 |
| Ticket | `roadId` (升序) + `createdAt` (降序) | 路段评论列表 |
| Road | `totalTickets` (降序) | 总榜排行 |
| Road | `name` (升序) + `city` (升序) | 路段查询 |

---

## 四、体验优化

### 4.1 请求超时控制

**问题：** `callFunction` 无超时，弱网或切后台时 loading 遮罩卡死。

**修改：** `utils/cloud.js` — 增加 15 秒超时（`Promise.race`）；loading 改为引用计数，解决并发调用时提前关闭问题；默认 `loading: false`。

### 4.2 排行榜定位失败降级

**问题：** 切换到"我的城市"但定位失败时，传空 city 请求云函数，返回空列表无提示。

**修改：** `pages/ranking/ranking.js` — `onScopeChange()` 中检测 city 为空时提示"定位失败，请授权定位后重试"并重新触发定位。

### 4.3 路段详情页内嵌贴罚单

**问题：** road-detail 的"给这条路贴罚单"按钮跳回首页，用户需重新搜索路段。

**修改：**
- `pages/road-detail/road-detail.json` — 注册 ticket-panel 组件
- `pages/road-detail/road-detail.wxml` — 内嵌 ticket-panel 和成功弹窗
- `pages/road-detail/road-detail.js` — 添加贴罚单提交、结果展示逻辑

### 4.4 分享图生成 loading 指示

**问题：** share-canvas 生成图片需要 2-5 秒，无 loading 指示，用户以为卡住。

**修改：**
- `components/share-canvas/share-canvas.js` — 增加 `drawing` 状态位
- `components/share-canvas/share-canvas.wxml` — 生成中显示"正在生成分享图..."loading 指示

---

## 修改文件清单

| 文件 | 改动类型 |
|------|---------|
| `cloudfunctions/geocoder/index.js` | 安全：环境变量 + openid 校验 + 路名提取优化 |
| `cloudfunctions/road-search/index.js` | 安全：环境变量 + openid 校验 |
| `cloudfunctions/road-ranking/index.js` | 安全：openid 校验；性能：聚合查询 |
| `cloudfunctions/road-detail/index.js` | 安全：openid 校验 |
| `cloudfunctions/share-qrcode/index.js` | 安全：openid 校验 |
| `cloudfunctions/user-info/index.js` | 安全：昵称安全检测；性能：去掉 count 查询 |
| `cloudfunctions/ticket-create/index.js` | Bug：DailyLimit 顺序 + User.totalTickets 同步；性能：并行优化 |
| `pages/ranking/ranking.js` | 安全：API Key 迁移；UX：定位降级 |
| `pages/road-detail/road-detail.js` | UX：内嵌贴罚单 |
| `pages/road-detail/road-detail.wxml` | UX：内嵌贴罚单 |
| `pages/road-detail/road-detail.json` | UX：注册 ticket-panel |
| `components/share-canvas/share-canvas.js` | UX：loading 状态 |
| `components/share-canvas/share-canvas.wxml` | UX：loading 指示 |
| `utils/cloud.js` | UX：超时控制 + loading 引用计数 |

---

## 部署检查清单

- [ ] 云开发控制台配置环境变量 `TENCENT_MAP_KEY`、`TENCENT_MAP_SK`
- [ ] 重新部署全部 8 个云函数
- [ ] 创建 Ticket 集合索引：`{userId, createdAt}`、`{roadId, createdAt}`
- [ ] 创建 Road 集合索引：`{totalTickets}`、`{name, city}`
- [ ] 微信开发者工具重新编译前端代码
- [ ] 真机测试核心流程：搜索 → 贴罚单 → 排行榜 → 个人中心

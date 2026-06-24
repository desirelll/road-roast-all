# 路路辣评 (Road Roast) — 产品路线图

> 最后更新：2026-06-24

---

## 已完成

### 2026-06-24 — 核心链路 bug 修复

**改动**
- 修复搜索已有路段时把腾讯 POI id 当 Road id 传给贴罚单云函数的问题
- road-ranking 返回 location，首页热门路段和地图 marker 可正常消费排行榜数据
- ticket-create 改为事务写入 DailyLimit、Ticket、Road.totalTickets、User.totalTickets，避免部分成功造成脏数据
- User.totalTickets 更新改为增量 update，不再替换用户文档导致昵称头像丢失
- 分享小程序码 scene 改为 `roadId=...`，路段详情页兼容扫码进入的 scene 参数
- share-qrcode 使用上传后的 fileID 获取临时链接，避免 cloudPath 取 URL 失败
- callFunction 业务错误只 toast 一次
- 资料页禁止保存空昵称/空头像，并修复昵称防抖保存覆盖头像上传结果的竞态

**涉及文件**
- `cloudfunctions/road-search/index.js`
- `cloudfunctions/road-ranking/index.js`
- `cloudfunctions/ticket-create/index.js`
- `cloudfunctions/share-qrcode/index.js`
- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/road-detail/road-detail.js`
- `pages/profile/profile.js`
- `utils/cloud.js`
- `tests/static-contracts.test.js`

### 2026-06-24 — 授权体验优化

**改动**
- 首页头像昵称授权增加检查中状态，避免已授权用户短暂看到授权弹层
- 首次进入不主动拉起定位授权，未授权时先展示默认地图，定位按钮再负责授权引导
- 定位拒绝后从设置页返回会自动重试定位，失败时保留默认地图和搜索能力
- 修复热门路段为空时误显示“无法获取定位”降级块的问题
- 资料页头像先上传至云存储再保存，避免写入临时头像路径
- 资料页昵称改为输入后防抖保存，保存失败会重新拉取服务端资料
- 排行榜“我的城市”改为按需定位，失败时保留全国榜

**涉及文件**
- `utils/location-auth.js` — 新增定位权限判断 helper
- `tests/location-auth.test.js` — 新增 helper 单元测试
- `pages/index/` — 首页授权弹层、定位状态和设置引导
- `tests/index-wxml.test.js` — 新增首页定位降级块回归测试
- `pages/profile/` — 资料页头像上传、昵称保存状态
- `pages/ranking/ranking.js` — 我的城市定位授权流程

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

### 2026-06-23 — 附近路段推荐

**改动**
- 首页地图下方增加"热门路段"横向滚动卡片，展示前 5 个热门路段
- 点击可跳转路段详情页

**涉及文件**
- `pages/index/index.js` — nearbyRoads 数据、点击事件
- `pages/index/index.wxml` — 卡片 UI
- `pages/index/index.wxss` — 卡片样式

### 2026-06-23 — 用户排行榜

**改动**
- 新增 user-ranking 云函数，按 User.totalTickets 排序
- 排行榜页面增加"路段排行"和"达人排行" tab 切换
- 用户排行展示：排名、头像、昵称、罚单数
- 显示当前用户排名

**涉及文件**
- `cloudfunctions/user-ranking/` — 新增云函数
- `pages/ranking/ranking.js` — tab 切换、loadUserRankings
- `pages/ranking/ranking.wxml` — 用户排行 UI
- `pages/ranking/ranking.wxss` — 用户排行样式

### 2026-06-23 — P0 Bug 修复

**改动**
- ranking.js: onPullDownRefresh 三元表达式改为 if/else，修复用户榜下拉崩溃
- cloud.js: result 为 null 时增加防御，修复云函数返回异常崩溃
- ranking.wxml: 空状态改为独立 wx:if，修复路段排行空状态不显示
- ticket-panel.js: 补充缺失的 onShareTimeline/onClose/onTextareaFocus/onTextareaBlur
- road-ranking: 周期榜城市过滤移到 skip/limit 之前，totalCount 应用相同过滤
- ticket-create: User update 改为 set，确保记录不存在时也能创建
- user-info: getUserInfo 竞态安全，duplicate 时重新查询

**涉及文件**
- `pages/ranking/ranking.js` — onPullDownRefresh 修复
- `pages/ranking/ranking.wxml` — 空状态条件修复
- `utils/cloud.js` — result null 防御
- `components/ticket-panel/ticket-panel.js` — 补充缺失方法
- `cloudfunctions/ticket-create/index.js` — User set 修复
- `cloudfunctions/road-ranking/index.js` — 聚合管道顺序修复
- `cloudfunctions/user-info/index.js` — 竞态安全修复

### 2026-06-23 — P1/P2 Bug 修复

**改动**
- cloud.js: 超时定时器清理，避免内存泄漏
- index.js: 授权轮询增加最大重试次数（10秒超时）、onUnload 清理搜索 timer
- profile.js: userInfo 为 null 时防御、saveProfile 增加 .catch
- ranking.js: 快速切换 scope/period 时重置 loading
- road-detail.js: roadId 缺失时 1.5 秒后自动返回
- geocoder: lat/lng 参数校验增强、address_component 空值防御、删除调试日志
- road-search: RegExp 正则转义防止 ReDoS
- ticket-create: comment 校验增加类型检查和 trim

**涉及文件**
- `utils/cloud.js` — 定时器清理
- `pages/index/index.js` — 授权轮询、onUnload
- `pages/profile/profile.js` — null 防御、catch
- `pages/ranking/ranking.js` — loading 重置
- `pages/road-detail/road-detail.js` — 自动返回
- `cloudfunctions/geocoder/index.js` — 参数校验、空值防御、日志清理
- `cloudfunctions/road-search/index.js` — 正则转义
- `cloudfunctions/ticket-create/index.js` — comment 校验

---

## 中期（上线后迭代）

- [x] P2 UX 问题修复：首页骨架屏、时间格式化、Marker 点击交互、页面栈溢出防护
- [x] 朋友圈原生分享：增加 onShareTimeline
- [x] 数据埋点：贴罚单数、搜索次数、分享次数
- [x] geocoder/road-search 公共模块抽取（签名函数、formatTime）— 暂不抽取，代码量小
- [x] 附近路段推荐
- [x] 用户排行榜

---

## 长期（产品演进）

- [ ] 附近路段推荐：基于定位自动推荐周边可吐槽路段
- [ ] 用户排行榜：谁贴的罚单最多
- [ ] 消息通知：你吐槽的路段被跟帖时通知
- [ ] 罚单详情页：单条罚单的分享/互动
- [ ] 内容审核兜底：违规内容举报/处理机制

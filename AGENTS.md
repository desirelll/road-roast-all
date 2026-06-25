# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

「路路辣评」(Road Roast) — 微信小程序，城市通勤路况吐槽平台。核心交互：用户在地图上定位/搜索路段 → 贴罚单 → 排行榜展示最差路段。

## 技术栈

- **前端**：微信小程序原生开发
- **后端**：微信云开发（云数据库 + 云函数 + 云存储）
- **地图**：腾讯地图 POI API
- **开发工具**：微信开发者工具

## 目录结构

```
road-roast/
├── pages/
│   ├── index/          # Tab: 贴罚单
│   ├── ranking/         # Tab: 排行榜
│   ├── profile/         # Tab: 我的
│   └── road-detail/     # 路段详情（非 Tab）
├── components/
│   ├── ticket-panel/    # 贴罚单操作面板
│   ├── comment-item/    # 评论列表项
│   ├── road-item/       # 排行榜路段项
│   └── share-canvas/    # 朋友圈分享图片 Canvas 绘制
├── cloudfunctions/      # 云函数目录（每个函数一个子目录）
├── utils/
│   ├── cloud.js         # 云函数调用封装
│   └── auth.js          # 静默登录逻辑
├── images/
└── styles/
    └── variables.wxss   # 公共样式变量
```

## 云数据库表

| 表 | 关键字段 | 用途 |
|---|---|---|
| User | openid, nickname, avatar, totalTickets | 用户信息 |
| Road | province, city, name, fullName, location(GeoPoint), totalTickets | 路段数据 |
| Ticket | userId, roadId, comment, nickname, avatar, createdAt | 罚单/评论 |
| DailyLimit | _id=`userId_roadId_YYYY-MM-DD`, userId, roadId, date | 每日限制 |

**索引**：Ticket 表 `roadId + createdAt` 复合索引、`userId + createdAt` 复合索引。

## 云函数（6 个）

| 函数 | 职责 |
|------|------|
| ticket-create | 贴罚单：校验每日限制、创建 Ticket、原子更新 Road.totalTickets、内容安全检测 |
| ticket-list | 查询我的罚单记录（分页） |
| road-search | 搜索路段（调用腾讯地图 POI API），关键词缓存 5 分钟 |
| road-ranking | 排行榜查询（全国/城市，本周/本月/本年/总榜），从 Ticket 聚合或 Road 直接查 |
| road-detail | 路段详情 + 评论列表（分页） |
| user-info | 获取/更新用户信息 |

## 关键技术决策

1. **原子计数**：`Road.totalTickets` 使用 `db.command.inc(1)`，避免竞态
2. **懒重置**：Road 表只保留 totalTickets 累计字段，排行榜周期计数从 Ticket 表按时间范围聚合
3. **排行榜查询**：依赖数据库复合索引 + `.limit(100)`，不额外加缓存层
4. **冗余存储**：Ticket 表冗余 nickname/avatar，避免评论列表 join User 表
5. **安全校验**：云函数通过 openid 校验身份，不信任前端传入的 userId；评论调用 `msgSecCheck`
6. **每日限制**：DailyLimit 表用 `_id = userId_roadId_date` 模拟复合唯一约束
7. **POI 搜索**：前端 300ms 防抖，云函数层缓存关键词
8. **静默登录**：启动时通过云开发自动获取 openid，无需用户主动授权

## 开发约定

- 微信开发者工具打开 `road-roast/` 目录作为项目根目录
- 云函数部署通过微信开发者工具上传，或使用 `cloudfunctions/` 目录的右键菜单
- 数据库索引修改需在云开发控制台操作
- 地图 API Key 配置在小程序管理后台 → 开发管理 → 接口设置

## 变更记录规范

- **所有比较复杂的代码改动**（新功能、安全修复、性能优化、架构调整等）必须记录到项目根目录的 `ROADMAP.md`
- 记录内容包括：改动类型、具体做了什么、涉及哪些文件
- 如果改动有对应的详细文档，在记录中链接过去（如 `docs/changelog-xxx.md`）
- 简单的 typo 修复、格式调整等不需要记录

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { scope = 'national', period = 'all', city, page = 1, pageSize = 20 } = event

  const skip = (page - 1) * pageSize
  const limit = Math.min(pageSize, 50)

  try {
    if (period === 'all') {
      return await totalRanking(scope, city, skip, limit)
    }
    return await periodRanking(scope, period, city, skip, limit)
  } catch (e) {
    console.error('road-ranking error:', e)
    return { code: -1, message: '查询失败，请重试' }
  }
}

// 总榜：直接查 Road 表
async function totalRanking(scope, city, skip, limit) {
  let query = db.collection('Road')
  if (scope === 'city' && city) {
    query = query.where({ city })
  }
  const res = await query
    .orderBy('totalTickets', 'desc')
    .skip(skip)
    .limit(limit)
    .get()

  return {
    code: 0,
    data: {
      list: res.data.map((item) => ({
        roadId: item._id,
        name: item.name,
        fullName: item.fullName,
        city: item.city || '',
        province: item.province || '',
        totalTickets: item.totalTickets || 0
      })),
      hasMore: res.data.length >= limit
    },
    message: 'ok'
  }
}

// 周期榜：普通查询 + JS 分组（避开聚合管道日期比较的坑）
async function periodRanking(scope, period, city, skip, limit) {
  let startTime

  if (period === 'week') {
    const d = new Date()
    const dayOfWeek = d.getDay() || 7
    startTime = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek + 1)
  } else if (period === 'month') {
    startTime = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  } else if (period === 'year') {
    startTime = new Date(new Date().getFullYear(), 0, 1)
  }

  // 1. 用普通 where 查时间范围内的 Ticket，拿满 500 条做统计
  const ticketRes = await db.collection('Ticket')
    .where({ createdAt: db.command.gte(startTime) })
    .field({ roadId: true })
    .limit(500)
    .get()

  if (ticketRes.data.length === 0) {
    return { code: 0, data: { list: [], hasMore: false }, message: 'ok' }
  }

  // 2. JS 分组计数
  const countMap = new Map()
  ticketRes.data.forEach((t) => {
    countMap.set(t.roadId, (countMap.get(t.roadId) || 0) + 1)
  })

  // 3. 按票数降序排列
  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([roadId, count]) => ({ roadId, count }))

  // 4. 批量查 Road 信息
  if (sorted.length === 0) {
    return { code: 0, data: { list: [], hasMore: false }, message: 'ok' }
  }

  const roadIds = sorted.map((s) => s.roadId)
  const roadRes = await db.collection('Road')
    .where({ _id: db.command.in(roadIds) })
    .get()

  const roadMap = new Map()
  roadRes.data.forEach((r) => {
    roadMap.set(r._id, r)
  })

  // 5. 组装结果，城市过滤
  let result = sorted
    .map((s) => {
      const road = roadMap.get(s.roadId)
      return {
        roadId: s.roadId,
        name: road ? road.name : '',
        fullName: road ? road.fullName : '',
        city: road ? road.city || '' : '',
        province: road ? road.province || '' : '',
        totalTickets: s.count
      }
    })
    .filter((item) => item.name !== '') // 过滤掉已删除的路段

  if (scope === 'city' && city) {
    result = result.filter((item) => item.city === city)
  }

  // 6. 分页
  const paged = result.slice(skip, skip + limit)
  return {
    code: 0,
    data: {
      list: paged,
      hasMore: skip + limit < result.length
    },
    message: 'ok'
  }
}

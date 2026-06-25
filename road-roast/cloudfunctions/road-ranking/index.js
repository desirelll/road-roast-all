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
        totalTickets: item.totalTickets || 0,
        location: formatLocation(item.location)
      })),
      hasMore: res.data.length >= limit
    },
    message: 'ok'
  }
}

// 周期榜：聚合管道在数据库层完成分组计数，无 500 条限制
async function periodRanking(scope, period, city, skip, limit) {
  const $ = db.command.aggregate
  const _ = db.command

  let startTime
  if (period === 'week') {
    const d = new Date()
    const dayOfWeek = d.getDay() || 7
    startTime = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek + 1)
  } else if (period === 'month') {
    startTime = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  } else if (period === 'year') {
    startTime = new Date(new Date().getFullYear(), 0, 1)
  } else {
    return { code: -1, message: '无效的周期参数' }
  }

  const createPeriodQuery = () => {
    let query = db.collection('Ticket')
      .aggregate()
      .match({ createdAt: _.gte(startTime) })
      .group({ _id: '$roadId', count: $.sum(1) })
      .sort({ count: -1 })
      .lookup({
        from: 'Road',
        localField: '_id',
        foreignField: '_id',
        as: 'road'
      })
      .unwind('$road')

    if (scope === 'city' && city) {
      query = query.match({ 'road.city': city })
    }
    return query
  }

  // 查总数（应用相同的城市过滤）
  const countRes = await createPeriodQuery().end()
  const totalCount = countRes.list.length

  // 分页查询
  const res = await createPeriodQuery()
    .skip(skip)
    .limit(limit)
    .end()

  const list = res.list.map((item) => ({
    roadId: item._id,
    name: item.road.name,
    fullName: item.road.fullName || '',
    city: item.road.city || '',
    province: item.road.province || '',
    totalTickets: item.count,
    location: formatLocation(item.road.location)
  }))

  return {
    code: 0,
    data: {
      list,
      hasMore: skip + limit < totalCount
    },
    message: 'ok'
  }
}

function formatLocation(location) {
  if (!location) return null
  const lat = location.lat ?? location.latitude ?? location._latitude
  const lng = location.lng ?? location.longitude ?? location._longitude
  if (lat === undefined || lng === undefined) return null
  return { lat, lng }
}

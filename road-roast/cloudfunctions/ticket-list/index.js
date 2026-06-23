const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, message: '未获取到用户身份' }
  }

  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize
  const limit = Math.min(pageSize, 50)

  try {
    // 1. 查我的 Ticket 列表
    const ticketRes = await db.collection('Ticket')
      .where({ userId: openid })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    if (ticketRes.data.length === 0) {
      return { code: 0, data: { list: [], hasMore: false }, message: 'ok' }
    }

    // 2. 批量查路段名
    const roadIds = [...new Set(ticketRes.data.map((t) => t.roadId))]
    const roadRes = await db.collection('Road')
      .where({ _id: db.command.in(roadIds) })
      .get()

    const roadMap = new Map()
    roadRes.data.forEach((r) => {
      roadMap.set(r._id, r)
    })

    // 3. 组装结果
    const list = ticketRes.data.map((ticket) => {
      const road = roadMap.get(ticket.roadId)
      return {
        id: ticket._id,
        roadId: ticket.roadId,
        roadName: road ? road.name : '未知路段',
        comment: ticket.comment || '',
        createdAt: formatTime(ticket.createdAt)
      }
    })

    return {
      code: 0,
      data: {
        list,
        hasMore: ticketRes.data.length >= limit
      },
      message: 'ok'
    }
  } catch (e) {
    console.error('ticket-list error:', e)
    return { code: -1, message: '查询失败，请重试' }
  }
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

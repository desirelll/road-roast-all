const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { roadId, page = 1, pageSize = 20 } = event

  if (!roadId) {
    return { code: -1, message: '缺少路段ID' }
  }

  const limit = Math.min(pageSize, 50)
  const skip = (page - 1) * limit

  try {
    // 并行查询：路段信息 + 评论列表
    const [roadRes, commentsRes] = await Promise.all([
      db.collection('Road').doc(roadId).get(),
      db.collection('Ticket')
        .where({ roadId })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    ])

    if (!roadRes.data) {
      return { code: -1, message: '路段不存在' }
    }

    const road = roadRes.data

    return {
      code: 0,
      data: {
        road: {
          roadId: road._id,
          name: road.name,
          fullName: road.fullName,
          province: road.province || '',
          city: road.city || '',
          totalTickets: road.totalTickets || 0,
          location: road.location
        },
        comments: (commentsRes.data || []).map((item) => ({
          id: item._id,
          nickname: item.nickname || '匿名',
          avatar: item.avatar || '',
          comment: item.comment || '',
          createdAt: formatTime(item.createdAt)
        })),
        hasMore: (commentsRes.data || []).length >= limit
      },
      message: 'ok'
    }
  } catch (e) {
    console.error('road-detail error:', e)
    return { code: -1, message: '查询失败，请重试' }
  }
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, message: '未获取到用户身份' }
  }

  const { roadId, roadName, province, city, location, comment } = event

  if (!roadName || !province || !city) {
    return { code: -1, message: '路段信息不完整' }
  }

  if (comment && (typeof comment !== 'string' || comment.trim().length > 50)) {
    return { code: -1, message: '吐槽最多50个字' }
  }

  const today = formatDate(new Date())
  let finalRoadId = roadId

  // 1. 查找或创建 Road
  if (!finalRoadId) {
    try {
      const roadRes = await db.collection('Road')
        .where({ name: roadName, city })
        .get()

      if (roadRes.data.length > 0) {
        finalRoadId = roadRes.data[0]._id
      } else {
        const createRoadRes = await db.collection('Road').add({
          data: {
            province,
            city,
            name: roadName,
            fullName: `${province}-${city}-${roadName}`,
            location: db.Geo.Point(
              location ? (location.longitude || location.lng || 0) : 0,
              location ? (location.latitude || location.lat || 0) : 0
            ),
            totalTickets: 0,
            createdAt: db.serverDate()
          }
        })
        finalRoadId = createRoadRes._id
      }
    } catch (e) {
      console.error('ticket-create Road error:', e)
      return { code: -1, message: '路段查询失败: ' + (e.message || '请重试') }
    }
  }

  // 2. 内容安全检测 + 获取用户信息（并行执行）
  let nickname = ''
  let avatar = ''
  try {
    const [, userRes] = await Promise.all([
      comment ? cloud.openapi.security.msgSecCheck({ content: comment }) : Promise.resolve(),
      db.collection('User').where({ openid }).get().catch(() => ({ data: [] }))
    ])
    if (userRes.data.length > 0) {
      nickname = userRes.data[0].nickname || ''
      avatar = userRes.data[0].avatar || ''
    }
  } catch (e) {
    return { code: -3, message: '内容包含敏感词，请修改' }
  }

  // 4. 利用 DailyLimit._id 唯一性做每日限制（放在安全检测之后，避免检测失败留下脏数据）
  const limitId = `${openid}_${finalRoadId}_${today}`
  try {
    await db.collection('DailyLimit').add({
      data: {
        _id: limitId,
        userId: openid,
        roadId: finalRoadId,
        date: today
      }
    })
  } catch (e) {
    // _id 重复 → 今天已经贴过了
    return { code: -2, message: '今天已经给这条路贴过罚单了' }
  }

  // 5. 创建 Ticket + 更新 Road.totalTickets + 更新 User.totalTickets
  try {
    const ticketRes = await db.collection('Ticket').add({
      data: {
        userId: openid,
        roadId: finalRoadId,
        comment: comment || '',
        nickname,
        avatar,
        createdAt: db.serverDate()
      }
    })

    // 并行更新 Road 和 User 的罚单计数
    // User 使用 set 确保记录不存在时也能创建
    await Promise.all([
      db.collection('Road').doc(finalRoadId).update({
        data: { totalTickets: db.command.inc(1) }
      }),
      db.collection('User').where({ openid }).set({
        data: {
          openid,
          totalTickets: db.command.inc(1),
          createdAt: db.serverDate()
        }
      })
    ])

    // 查询更新后的 Road 信息（inc 是原子操作，此时已是最新的）
    const roadRes = await db.collection('Road').doc(finalRoadId).get()
    const road = roadRes.data

    return {
      code: 0,
      data: {
        ticketId: ticketRes._id,
        roadId: finalRoadId,
        roadName: road.fullName || road.name,
        totalTickets: road.totalTickets,
        shareText: `我给${road.name}贴了一张罚单，它已累计${road.totalTickets}张罚单`
      },
      message: '贴罚单成功'
    }
  } catch (e) {
    console.error('ticket-create write error:', e)
    return { code: -1, message: '贴罚单失败: ' + (e.message || '请重试') }
  }
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

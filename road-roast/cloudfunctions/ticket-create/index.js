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

  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    return { code: -1, message: '吐槽最多50个字' }
  }

  const finalComment = comment ? comment.trim() : ''
  if (finalComment.length > 50) {
    return { code: -1, message: '吐槽最多50个字' }
  }

  const today = formatDate(new Date())
  let finalRoadId

  try {
    finalRoadId = await ensureRoad(roadId, { roadName, province, city, location })
  } catch (e) {
    console.error('ticket-create Road error:', e)
    return { code: -1, message: '路段查询失败: ' + (e.message || '请重试') }
  }

  let nickname = ''
  let avatar = ''
  try {
    const [, userRes] = await Promise.all([
      finalComment ? cloud.openapi.security.msgSecCheck({ content: finalComment }) : Promise.resolve(),
      db.collection('User').where({ openid }).get().catch(() => ({ data: [] }))
    ])
    if (userRes.data.length > 0) {
      nickname = userRes.data[0].nickname || ''
      avatar = userRes.data[0].avatar || ''
    }
  } catch (e) {
    return { code: -3, message: '内容包含敏感词，请修改' }
  }

  const limitId = `${openid}_${finalRoadId}_${today}`
  const transaction = await db.startTransaction()

  try {
    await transaction.collection('DailyLimit').add({
      data: {
        _id: limitId,
        userId: openid,
        roadId: finalRoadId,
        date: today
      }
    })

    const ticketRes = await transaction.collection('Ticket').add({
      data: {
        userId: openid,
        roadId: finalRoadId,
        comment: finalComment,
        nickname,
        avatar,
        createdAt: db.serverDate()
      }
    })

    await transaction.collection('Road').doc(finalRoadId).update({
      data: { totalTickets: db.command.inc(1) }
    })
    await updateUserTotalTickets(transaction, openid)

    const roadRes = await transaction.collection('Road').doc(finalRoadId).get()
    const road = roadRes.data
    await transaction.commit()

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
    try {
      await transaction.rollback()
    } catch (rollbackErr) {
      console.error('ticket-create rollback error:', rollbackErr)
    }
    if (isDuplicateKeyError(e)) {
      return { code: -2, message: '今天已经给这条路贴过罚单了' }
    }
    console.error('ticket-create write error:', e)
    return { code: -1, message: '贴罚单失败: ' + (e.message || '请重试') }
  }
}

async function ensureRoad(roadId, road) {
  if (roadId) {
    try {
      const roadRes = await db.collection('Road').doc(roadId).get()
      if (roadRes.data) return roadId
    } catch (e) {
      // 传入的 roadId 可能来自旧搜索结果，继续按路名兜底。
    }
  }

  const { roadName, province, city, location } = road
  const roadRes = await db.collection('Road')
    .where({ name: roadName, city })
    .get()

  if (roadRes.data.length > 0) {
    return roadRes.data[0]._id
  }

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
  return createRoadRes._id
}

async function updateUserTotalTickets(transaction, openid) {
  const userRes = await transaction.collection('User').where({ openid }).get()
  if (userRes.data.length > 0) {
    return transaction.collection('User').doc(userRes.data[0]._id).update({
      data: {
        totalTickets: db.command.inc(1),
        updatedAt: db.serverDate()
      }
    })
  }

  return transaction.collection('User').add({
    data: {
      openid,
      nickname: '',
      avatar: '',
      totalTickets: 1,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
}

function isDuplicateKeyError(e) {
  const msg = `${e.errMsg || ''} ${e.message || ''}`
  return msg.includes('duplicate') || msg.includes('already exists') || msg.includes('-502001')
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

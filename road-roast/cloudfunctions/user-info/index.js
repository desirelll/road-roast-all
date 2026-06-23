const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return { code: -1, message: '未获取到用户身份' }
  }

  const { action = 'get', nickname, avatar } = event

  try {
    if (action === 'get') {
      return await getUserInfo(openid)
    }
    if (action === 'update') {
      return await updateUserInfo(openid, nickname, avatar)
    }
    return { code: -1, message: '未知操作' }
  } catch (e) {
    console.error('user-info error:', e)
    return { code: -1, message: '操作失败，请重试' }
  }
}

async function getUserInfo(openid) {
  const userRes = await db.collection('User').where({ openid }).get()

  if (userRes.data.length === 0) {
    // 首次：创建用户记录
    await db.collection('User').add({
      data: {
        openid,
        nickname: '',
        avatar: '',
        totalTickets: 0,
        createdAt: db.serverDate()
      }
    })
    return {
      code: 0,
      data: {
        openid,
        nickname: '',
        avatar: '',
        totalTickets: 0
      },
      message: 'ok'
    }
  }

  const user = userRes.data[0]

  // 统计最新罚单数
  const countRes = await db.collection('Ticket')
    .where({ userId: openid })
    .count()

  return {
    code: 0,
    data: {
      openid: user.openid,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      totalTickets: countRes.total
    },
    message: 'ok'
  }
}

async function updateUserInfo(openid, nickname, avatar) {
  const updateData = {}
  if (nickname !== undefined) updateData.nickname = nickname
  if (avatar !== undefined) updateData.avatar = avatar

  if (Object.keys(updateData).length === 0) {
    return { code: -1, message: '无更新内容' }
  }

  // 确保用户记录存在
  const userRes = await db.collection('User').where({ openid }).get()
  if (userRes.data.length === 0) {
    await db.collection('User').add({
      data: {
        openid,
        nickname: nickname || '',
        avatar: avatar || '',
        totalTickets: 0,
        createdAt: db.serverDate()
      }
    })
  } else {
    await db.collection('User').doc(userRes.data[0]._id).update({
      data: updateData
    })
  }

  return { code: 0, data: { nickname, avatar }, message: 'ok' }
}

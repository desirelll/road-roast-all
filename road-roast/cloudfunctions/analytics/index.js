const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { event: eventName, data = {} } = event

  if (!eventName) {
    return { code: -1, message: '缺少事件名' }
  }

  try {
    await db.collection('Analytics').add({
      data: {
        userId: openid,
        event: eventName,
        data,
        createdAt: db.serverDate()
      }
    })
    return { code: 0, message: 'ok' }
  } catch (e) {
    console.error('analytics error:', e)
    return { code: -1, message: '记录失败' }
  }
}

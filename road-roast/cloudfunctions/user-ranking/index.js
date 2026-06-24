const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize
  const limit = Math.min(pageSize, 50)

  try {
    const res = await db.collection('User')
      .where({ totalTickets: db.command.gt(0) })
      .orderBy('totalTickets', 'desc')
      .skip(skip)
      .limit(limit)
      .field({ nickname: true, avatar: true, totalTickets: true })
      .get()

    // 查询当前用户排名
    let myRank = null
    const myRes = await db.collection('User').where({ openid }).field({ totalTickets: true }).get()
    if (myRes.data.length > 0 && myRes.data[0].totalTickets > 0) {
      const countRes = await db.collection('User')
        .where({ totalTickets: db.command.gt(myRes.data[0].totalTickets) })
        .count()
      myRank = countRes.total + 1
    }

    return {
      code: 0,
      data: {
        list: res.data.map((item, index) => ({
          rank: skip + index + 1,
          nickname: item.nickname || '匿名用户',
          avatar: item.avatar || '',
          totalTickets: item.totalTickets || 0
        })),
        hasMore: res.data.length >= limit,
        myRank
      },
      message: 'ok'
    }
  } catch (e) {
    console.error('user-ranking error:', e)
    return { code: -1, message: '查询失败，请重试' }
  }
}

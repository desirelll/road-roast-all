/**
 * 静默登录
 * 通过云开发自动获取 openid，无需用户主动授权
 */
function silentLogin() {
  return wx.cloud
    .callFunction({ name: 'login', data: {} })
    .then((res) => {
      const { result } = res
      if (result && result.openid) {
        getApp().globalData.openid = result.openid
      }
    })
    .catch((err) => {
      console.error('静默登录失败:', err)
    })
}

/**
 * 检查用户是否已完成授权（头像+昵称）
 * 从 User 表读取，已授权则写入 globalData
 */
function checkAuth() {
  return wx.cloud
    .callFunction({ name: 'user-info', data: { action: 'get' } })
    .then((res) => {
      const user = res.result?.data
      if (user && user.nickname && user.avatar) {
        getApp().globalData.userInfo = {
          nickname: user.nickname,
          avatar: user.avatar,
          totalTickets: user.totalTickets || 0
        }
        getApp().globalData.isAuthorized = true
      }
    })
    .catch((err) => {
      console.error('检查授权状态失败:', err)
    })
}

module.exports = { silentLogin, checkAuth }

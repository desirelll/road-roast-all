/**
 * 静默登录
 * 通过云开发自动获取 openid，无需用户主动授权
 */

function silentLogin() {
  wx.cloud
    .callFunction({
      name: 'login',
      data: {}
    })
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

module.exports = { silentLogin }

const { silentLogin, checkAuth } = require('./utils/auth')

App({
  globalData: {
    userInfo: null,
    openid: null,
    isAuthorized: false,
    _authChecked: false
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d6golby1da2b35db8',
      traceUser: true
    })
    // 静默登录 + 检查授权状态
    silentLogin()
      .then(() => checkAuth())
      .finally(() => {
        this.globalData._authChecked = true
      })
  }
})

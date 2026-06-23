const { silentLogin } = require('./utils/auth')

App({
  globalData: {
    userInfo: null,
    openid: null
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d6golby1da2b35db8',
      traceUser: true
    })
    silentLogin()
  }
})

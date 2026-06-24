const { callFunction, safeNavigate } = require('../../utils/cloud')

Page({
  data: {
    userInfo: null,
    totalTickets: 0,
    tickets: [],
    page: 1,
    hasMore: true,
    loading: false,
    savingProfile: false,
    profileSaveText: ''
  },

  onUnload() {
    if (this._nicknameTimer) clearTimeout(this._nicknameTimer)
    if (this._profileStatusTimer) clearTimeout(this._profileStatusTimer)
  },

  onShow() {
    this.setData({ page: 1, tickets: [], hasMore: true })
    this.loadUserInfo()
    this.loadTicketHistory()
  },

  async loadUserInfo() {
    try {
      const res = await callFunction('user-info', { action: 'get' }, { loading: false })
      if (res.code === 0 && res.data) {
        this.setData({
          userInfo: res.data,
          totalTickets: res.data.totalTickets || 0
        })
      }
    } catch (e) {
      // 错误已在 callFunction 中处理
    }
  },

  async loadTicketHistory() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await callFunction('ticket-list', {
        page: this.data.page,
        pageSize: 20
      }, { loading: false })

      if (res.code === 0 && res.data) {
        const list = this.data.page === 1
          ? res.data.list
          : [...this.data.tickets, ...res.data.list]

        this.setData({
          tickets: list,
          hasMore: res.data.hasMore,
          page: this.data.page + 1
        })
      }
    } catch (e) {
      // 错误已在 callFunction 中处理
    } finally {
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadTicketHistory()
    }
  },

  async onChooseAvatar(e) {
    const avatar = e.detail.avatarUrl
    if (!avatar || this.data.savingProfile) return
    if (this._nicknameTimer) clearTimeout(this._nicknameTimer)

    const previewUserInfo = { ...(this.data.userInfo || {}), avatar }
    this.setData({
      userInfo: previewUserInfo,
      savingProfile: true,
      profileSaveText: '上传头像中...'
    })

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatar/profile-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
        filePath: avatar
      })
      const userInfo = { ...previewUserInfo, avatar: uploadRes.fileID }
      this.setData({ userInfo })
      await this.saveProfile(userInfo, '头像已保存')
    } catch (e) {
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
      this.setData({ savingProfile: false, profileSaveText: '保存失败' })
      this.loadUserInfo()
    }
  },

  onNicknameInput(e) {
    const nickname = e.detail.value
    const userInfo = { ...(this.data.userInfo || {}), nickname }
    this.setData({ userInfo, profileSaveText: '编辑中' })

    if (this._nicknameTimer) clearTimeout(this._nicknameTimer)
    this._nicknameTimer = setTimeout(() => {
      this.saveProfile(this.data.userInfo, '昵称已保存')
    }, 600)
  },

  async saveProfile(userInfo, successText = '已保存') {
    if (!userInfo) return false

    const nickname = (userInfo.nickname || '').trim()
    const avatar = userInfo.avatar || ''

    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      this.loadUserInfo()
      return false
    }

    if (!avatar) {
      wx.showToast({ title: '请先设置头像', icon: 'none' })
      this.loadUserInfo()
      return false
    }

    this.setData({ savingProfile: true, profileSaveText: '保存中...' })

    try {
      await callFunction('user-info', {
        action: 'update',
        nickname,
        avatar
      }, { loading: false })

      const savedUserInfo = { ...userInfo, nickname, avatar }
      const app = getApp()
      app.globalData.userInfo = {
        ...(app.globalData.userInfo || {}),
        ...savedUserInfo
      }
      app.globalData.isAuthorized = Boolean(nickname && avatar)

      this.setData({
        userInfo: savedUserInfo,
        savingProfile: false,
        profileSaveText: successText
      })
      this.clearProfileStatusLater(successText)
      return true
    } catch (e) {
      this.setData({ savingProfile: false, profileSaveText: '保存失败' })
      this.loadUserInfo()
      return false
    }
  },

  clearProfileStatusLater(text) {
    if (this._profileStatusTimer) clearTimeout(this._profileStatusTimer)
    this._profileStatusTimer = setTimeout(() => {
      if (this.data.profileSaveText === text) {
        this.setData({ profileSaveText: '' })
      }
    }, 1500)
  },

  onTicketTap(e) {
    const roadId = e.currentTarget.dataset.roadId
    if (!roadId) return
    safeNavigate(`/pages/road-detail/road-detail?roadId=${roadId}`)
  }
})

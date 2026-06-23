const { callFunction } = require('../../utils/cloud')

Page({
  data: {
    userInfo: null,
    totalTickets: 0,
    tickets: [],
    page: 1,
    hasMore: true,
    loading: false
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

  onChooseAvatar(e) {
    const avatar = e.detail.avatarUrl
    const userInfo = { ...this.data.userInfo, avatar }
    this.setData({ userInfo })
    this.saveProfile(userInfo)
  },

  onNicknameChange(e) {
    const nickname = e.detail.value
    const userInfo = { ...this.data.userInfo, nickname }
    this.setData({ userInfo })
    this.saveProfile(userInfo)
  },

  saveProfile(userInfo) {
    callFunction('user-info', {
      action: 'update',
      nickname: userInfo.nickname || '',
      avatar: userInfo.avatar || ''
    }, { loading: false })
  },

  onTicketTap(e) {
    const roadId = e.currentTarget.dataset.roadId
    if (!roadId) return
    wx.navigateTo({ url: `/pages/road-detail/road-detail?roadId=${roadId}` })
  }
})

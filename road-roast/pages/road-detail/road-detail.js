const { callFunction } = require('../../utils/cloud')

Page({
  data: {
    roadId: '',
    road: null,
    comments: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad(options) {
    const { roadId } = options
    if (!roadId) {
      wx.showToast({ title: '路段不存在', icon: 'none' })
      return
    }
    this.setData({ roadId })
    this.loadData()
  },

  async loadData() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await callFunction('road-detail', {
        roadId: this.data.roadId,
        page: this.data.page,
        pageSize: 20
      }, { loading: false })

      if (res.code === 0 && res.data) {
        const comments = this.data.page === 1
          ? res.data.comments
          : [...this.data.comments, ...res.data.comments]

        this.setData({
          road: res.data.road,
          comments,
          hasMore: res.data.hasMore,
          page: this.data.page + 1
        })
      }
    } catch (e) {
      // 错误已在 callFunction 中提示
    } finally {
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadData()
    }
  },

  onPostTicket() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const { road } = this.data
    return {
      title: road ? `${road.name}已累计${road.totalTickets}张罚单` : '路路辣评',
      path: `/pages/road-detail/road-detail?roadId=${this.data.roadId}`
    }
  }
})

const { callFunction, trackEvent } = require('../../utils/cloud')

Page({
  data: {
    roadId: '',
    road: null,
    comments: [],
    page: 1,
    hasMore: true,
    loading: false,
    showPanel: false,
    posting: false,
    showResult: false,
    resultAnim: false,
    ticketResult: null
  },

  onLoad(options) {
    const { roadId } = options
    if (!roadId) {
      wx.showToast({ title: '路段不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
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
    this.setData({ showPanel: true })
  },

  onClosePanel() {
    this.setData({ showPanel: false })
  },

  async onPostTicketSubmit(e) {
    if (this.data.posting) return
    const { comment } = e.detail
    const { road } = this.data
    if (!road) return

    this.setData({ posting: true })

    try {
      const res = await callFunction('ticket-create', {
        roadId: this.data.roadId,
        roadName: road.name,
        province: road.province,
        city: road.city,
        location: road.location,
        comment
      })

      if (res.code === 0) {
        this.setData({
          showPanel: false,
          showResult: true,
          ticketResult: res.data,
          resultAnim: false,
          // 更新路段罚单数
          'road.totalTickets': res.data.totalTickets
        })
        setTimeout(() => {
          this.setData({ resultAnim: true })
        }, 100)
        trackEvent('ticket_create', { roadName: road.name, city: road.city })
        // 刷新评论列表
        this.setData({ page: 1, comments: [] }, () => {
          this.loadData()
        })
      }
    } catch (e) {
      // callFunction 已处理 toast
    } finally {
      this.setData({ posting: false })
    }
  },

  onCloseResult() {
    this.setData({ showResult: false, resultAnim: false, ticketResult: null })
  },

  onShareAppMessage() {
    trackEvent('share', { type: 'friend', roadId: this.data.roadId })
    const { road } = this.data
    return {
      title: road ? `${road.name}已累计${road.totalTickets}张罚单` : '路路辣评',
      path: `/pages/road-detail/road-detail?roadId=${this.data.roadId}`
    }
  },

  onShareTimeline() {
    trackEvent('share', { type: 'timeline', roadId: this.data.roadId })
    const { road } = this.data
    return {
      title: road ? `${road.name}已累计${road.totalTickets}张罚单` : '路路辣评',
      query: `roadId=${this.data.roadId}`
    }
  }
})

const { callFunction } = require('../../utils/cloud')

Page({
  data: {
    scope: 'national',
    period: 'all',
    rankings: [],
    page: 1,
    hasMore: true,
    loading: false,
    city: ''
  },

  onLoad() {
    this.getUserCity()
    this.loadRankings()
  },

  async getUserCity() {
    try {
      const locRes = await new Promise((resolve, reject) => {
        wx.getLocation({ type: 'gcj02', success: resolve, fail: reject })
      })
      const res = await callFunction('geocoder', {
        lat: locRes.latitude,
        lng: locRes.longitude
      }, { loading: false })
      if (res.code === 0 && res.data?.city) {
        this.setData({ city: res.data.city.replace('市', '') })
      }
    } catch (e) {
      // 定位失败或逆编码失败，city 保持空字符串
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, rankings: [] }, () => {
      this.loadRankings().then(() => wx.stopPullDownRefresh())
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRankings()
    }
  },

  async loadRankings() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await callFunction('road-ranking', {
        scope: this.data.scope,
        period: this.data.period,
        city: this.data.scope === 'city' ? this.data.city : undefined,
        page: this.data.page,
        pageSize: 20
      }, { loading: false })

      if (res.code === 0 && res.data) {
        const list = this.data.page === 1
          ? res.data.list
          : [...this.data.rankings, ...res.data.list]

        this.setData({
          rankings: list,
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

  onScopeChange(e) {
    const scope = e.currentTarget.dataset.scope
    if (scope === this.data.scope) return
    this.setData({ scope, page: 1, rankings: [], hasMore: true }, () => {
      this.loadRankings()
    })
  },

  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    if (period === this.data.period) return
    this.setData({ period, page: 1, rankings: [], hasMore: true }, () => {
      this.loadRankings()
    })
  },

  onRoadTap(e) {
    const roadId = e.currentTarget.dataset.roadId
    if (!roadId) return
    wx.navigateTo({
      url: `/pages/road-detail/road-detail?roadId=${roadId}`
    })
  },

  onShareAppMessage() {
    return {
      title: '来看看你城市的路有多堵',
      path: '/pages/ranking/ranking'
    }
  }
})

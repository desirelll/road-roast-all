const { callFunction, safeNavigate } = require('../../utils/cloud')
const { shouldGuideLocationSetting } = require('../../utils/location-auth')

Page({
  data: {
    tabType: 'road',
    scope: 'national',
    period: 'all',
    rankings: [],
    userRankings: [],
    page: 1,
    hasMore: true,
    loading: false,
    city: '',
    myRank: null
  },

  onLoad() {
    this.getUserCity({ userInitiated: false })
    this.loadRankings()
  },

  async getUserCity(options = {}) {
    const { userInitiated = false } = options
    try {
      const settingRes = await new Promise((resolve, reject) => {
        wx.getSetting({ success: resolve, fail: reject })
      })
      const authSetting = settingRes.authSetting || {}

      if (shouldGuideLocationSetting(authSetting)) {
        if (userInitiated) {
          return await this.openLocationSettingForCity()
        }
        return false
      }

      if (authSetting['scope.userLocation'] !== true && !userInitiated) {
        return false
      }

      return await this.locateAndSetCity()
    } catch (e) {
      return false
    }
  },

  async locateAndSetCity() {
    try {
      const locRes = await new Promise((resolve, reject) => {
        wx.getLocation({ type: 'gcj02', success: resolve, fail: reject })
      })
      const res = await callFunction('geocoder', {
        lat: locRes.latitude,
        lng: locRes.longitude
      }, { loading: false })
      if (res.code === 0 && res.data?.city) {
        this.setData({ city: res.data.city })
        return true
      }
      return false
    } catch (e) {
      // 定位失败或逆编码失败，city 保持空字符串
      return false
    }
  },

  openLocationSettingForCity() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '需要定位权限',
        content: '请在设置中允许访问位置信息，用于查看我的城市排行榜',
        confirmText: '去设置',
        success: (modalRes) => {
          if (!modalRes.confirm) {
            resolve(false)
            return
          }
          wx.openSetting({
            success: async (settingRes) => {
              const authSetting = settingRes.authSetting || {}
              if (authSetting['scope.userLocation'] === true) {
                resolve(await this.locateAndSetCity())
              } else {
                resolve(false)
              }
            },
            fail: () => resolve(false)
          })
        },
        fail: () => resolve(false)
      })
    })
  },

  onPullDownRefresh() {
    this.setData({ page: 1, rankings: [], userRankings: [], loading: false }, async () => {
      if (this.data.tabType === 'road') {
        await this.loadRankings()
      } else {
        await this.loadUserRankings()
      }
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      if (this.data.tabType === 'road') {
        this.loadRankings()
      } else {
        this.loadUserRankings()
      }
    }
  },

  onTabChange(e) {
    const tabType = e.currentTarget.dataset.tab
    if (tabType === this.data.tabType) return
    this.setData({ tabType, page: 1, rankings: [], userRankings: [], hasMore: true, myRank: null }, () => {
      if (tabType === 'road') {
        this.loadRankings()
      } else {
        this.loadUserRankings()
      }
    })
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

  async onScopeChange(e) {
    const scope = e.currentTarget.dataset.scope
    if (scope === this.data.scope) return

    // 切换到"我的城市"但定位失败时，提示用户
    if (scope === 'city' && !this.data.city) {
      const located = await this.getUserCity({ userInitiated: true })
      if (!located || !this.data.city) {
        wx.showToast({ title: '定位失败，已保持全国榜', icon: 'none' })
        return
      }
    }

    this.setData({ scope, page: 1, rankings: [], hasMore: true, loading: false }, () => {
      this.loadRankings()
    })
  },

  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    if (period === this.data.period) return
    this.setData({ period, page: 1, rankings: [], hasMore: true, loading: false }, () => {
      this.loadRankings()
    })
  },

  async loadUserRankings() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await callFunction('user-ranking', {
        page: this.data.page,
        pageSize: 20
      }, { loading: false })

      if (res.code === 0 && res.data) {
        const list = this.data.page === 1
          ? res.data.list
          : [...this.data.userRankings, ...res.data.list]

        this.setData({
          userRankings: list,
          hasMore: res.data.hasMore,
          page: this.data.page + 1,
          myRank: res.data.myRank
        })
      }
    } catch (e) {
      // 错误已在 callFunction 中提示
    } finally {
      this.setData({ loading: false })
    }
  },

  onRoadTap(e) {
    const roadId = e.currentTarget.dataset.roadId
    if (!roadId) return
    safeNavigate(`/pages/road-detail/road-detail?roadId=${roadId}`)
  },

  onShareAppMessage() {
    return {
      title: '来看看你城市的路有多堵',
      path: '/pages/ranking/ranking'
    }
  }
})

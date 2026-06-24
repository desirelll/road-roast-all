const { callFunction, safeNavigate, trackEvent } = require('../../utils/cloud')

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    markers: [],
    searchKeyword: '',
    searchResults: [],
    selectedRoad: null,
    ticketResult: null,
    showResult: false,
    resultAnim: false,
    showPanel: false,
    mapLoaded: false,
    mapLoading: true,
    posting: false,
    showShareCanvas: false,
    ticketCity: '',
    searching: false,
    nearbyRoads: [],
    // 授权相关
    isAuthorized: false,
    tempAvatar: '',
    tempNickname: '',
    authSubmitting: false,
  },

  onLoad() {
    this._searchGen = 0
    this.checkAuthState()
    this.getLocation()
    this.loadHotMarkers()
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
  },

  // ========== 授权 ==========
  checkAuthState() {
    const app = getApp()
    if (app.globalData.isAuthorized) {
      this.setData({ isAuthorized: true })
      return
    }
    // 等待 app.js 的 checkAuth 完成，最多等 10 秒
    let retries = 0
    const maxRetries = 50
    const check = () => {
      if (app.globalData.isAuthorized) {
        this.setData({ isAuthorized: true })
      } else if (!app.globalData._authChecked && retries < maxRetries) {
        retries++
        setTimeout(check, 200)
      }
    }
    setTimeout(check, 500)
  },

  onChooseAvatar(e) {
    this.setData({ tempAvatar: e.detail.avatarUrl })
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value })
  },

  async onAuthSubmit() {
    if (this.data.authSubmitting) return
    const { tempAvatar, tempNickname } = this.data
    if (!tempAvatar || !tempNickname.trim()) return

    this.setData({ authSubmitting: true })

    try {
      // 上传头像到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatar/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
        filePath: tempAvatar
      })

      // 保存用户信息
      const res = await callFunction('user-info', {
        action: 'update',
        nickname: tempNickname.trim(),
        avatar: uploadRes.fileID
      })

      if (res.code === 0) {
        const app = getApp()
        app.globalData.userInfo = {
          nickname: tempNickname.trim(),
          avatar: uploadRes.fileID,
          totalTickets: 0
        }
        app.globalData.isAuthorized = true
        this.setData({ isAuthorized: true })
        wx.showToast({ title: '欢迎加入！', icon: 'success' })
        // 授权完成后重新定位
        this.getLocation()
      }
    } catch (e) {
      wx.showToast({ title: '授权失败，请重试', icon: 'none' })
    } finally {
      this.setData({ authSubmitting: false })
    }
  },

  // ========== 定位 ==========
  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          mapLoaded: true,
          mapLoading: false
        })
      },
      fail: (err) => {
        // 定位失败时使用默认坐标显示地图，而非显示降级页
        this.setData({ mapLoaded: true, mapLoading: false })
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要定位权限',
            content: '请在设置中允许访问你的位置信息，用于地图展示和路段定位',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        }
      }
    })
  },

  // ========== 热门路段 Markers ==========
  async loadHotMarkers() {
    try {
      const res = await callFunction('road-ranking', {
        scope: 'national',
        period: 'all',
        page: 1,
        pageSize: 20
      }, { loading: false })

      if (res.code === 0 && res.data) {
        const roads = res.data.filter((item) => item.location)
        this._markerRoads = roads
        const markers = roads.map((item, index) => ({
          id: index,
          latitude: item.location.lat || item.location.latitude,
          longitude: item.location.lng || item.location.longitude,
          title: item.name,
          callout: { content: `${item.name} (${item.totalTickets}罚单)`, fontSize: 12, padding: 6 },
          iconPath: '/images/marker-ticket.png',
          width: 28,
          height: 36
        }))
        this.setData({ markers, nearbyRoads: roads.slice(0, 5) })
      }
    } catch (e) {
      // 热门路段加载失败不影响主流程
    }
  },

  // ========== 搜索 ==========
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })

    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
    }

    if (!keyword.trim()) {
      this.setData({ searchResults: [], searching: false })
      return
    }

    this.setData({ searching: true })
    this._searchTimer = setTimeout(() => {
      this.doSearch(keyword.trim())
    }, 500)
  },

  async doSearch(keyword) {
    if (!keyword) return

    // 竞态保护：记录请求版本号
    const gen = ++this._searchGen

    try {
      const res = await callFunction('road-search', { keyword }, { loading: false })
      // 版本号不匹配，丢弃过期结果
      if (gen !== this._searchGen) return
      if (res.code === 0) {
        this.setData({ searchResults: res.data, searching: false })
        trackEvent('search', { keyword, resultCount: res.data.length })
      }
    } catch (e) {
      if (gen !== this._searchGen) return
      this.setData({ searching: false })
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    }
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', searchResults: [] })
  },

  onSearchSelect(e) {
    const index = e.currentTarget.dataset.index
    const road = this.data.searchResults[index]
    if (!road) return

    this.selectRoad(road)
    this.setData({ searchResults: [], searchKeyword: '' })
  },

  // ========== 地图交互 ==========
  onMapTap(e) {
    const { latitude, longitude } = e.detail
    if (!latitude || !longitude) return

    this.reverseGeocode(latitude, longitude)
  },

  onMarkerTap(e) {
    const { markerId } = e.detail
    const roads = this._markerRoads || []
    const road = roads[markerId]
    if (!road || !road.roadId) return
    safeNavigate(`/pages/road-detail/road-detail?roadId=${road.roadId}`)
  },

  onNearbyTap(e) {
    const roadId = e.currentTarget.dataset.roadId
    if (!roadId) return
    safeNavigate(`/pages/road-detail/road-detail?roadId=${roadId}`)
  },

  async reverseGeocode(lat, lng) {
    wx.showLoading({ title: '识别路段...' })
    try {
      const res = await callFunction('geocoder', { lat, lng }, { loading: false })

      if (res.code === 0) {
        wx.hideLoading()
        this.selectRoad({
          id: null,
          name: res.data.name,
          address: res.data.address,
          province: res.data.province,
          city: res.data.city,
          location: { lat, lng },
          ticketCount: 0,
          isExisting: false
        })
      } else {
        wx.hideLoading()
        wx.showToast({ title: '无法识别该位置，请用搜索', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '识别失败，请用搜索', icon: 'none' })
    }
  },

  // ========== 选中路段 ==========
  selectRoad(road) {
    this.setData({
      selectedRoad: road,
      showPanel: true
    })
  },

  // ========== 贴罚单 ==========
  async onPostTicket(e) {
    if (this.data.posting) return

    const { comment } = e.detail
    const road = this.data.selectedRoad
    if (!road) return

    this.setData({ posting: true })

    try {
      const res = await callFunction('ticket-create', {
        roadId: road.id && road.isExisting ? road.id : null,
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
          ticketCity: road.city || '',
          resultAnim: false
        })
        // 缓存分享数据，不依赖 setData 响应式状态
        this._shareData = {
          title: res.data.shareText
            || `我给${res.data.roadName}贴了一张罚单，它已累计${res.data.totalTickets}张罚单`,
          path: res.data.roadId
            ? `/pages/road-detail/road-detail?roadId=${res.data.roadId}`
            : '/pages/index/index'
        }
        // 延迟触发动画，确保 DOM 渲染完毕
        setTimeout(() => {
          this.setData({ resultAnim: true })
        }, 100)
        this.loadHotMarkers()
        trackEvent('ticket_create', { roadName: road.name, city: road.city })
      }
      // 错误已在 callFunction 中 toast 提示
    } catch (e) {
      // callFunction 已处理 toast
    } finally {
      this.setData({ posting: false })
    }
  },

  onClosePanel() {
    this.setData({ showPanel: false, selectedRoad: null })
  },

  onCloseResult() {
    this.setData({ showResult: false, resultAnim: false, ticketResult: null })
  },

  // ========== 定位按钮 ==========
  onLocateUser() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation'] === false) {
          // 用户之前拒绝了，直接弹框引导去设置
          wx.showModal({
            title: '需要定位权限',
            content: '请在设置中允许访问你的位置信息',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          this.getLocation()
        }
      },
      fail: () => {
        this.getLocation()
      }
    })
  },

  // ========== 分享 ==========
  onShareAppMessage() {
    trackEvent('share', { type: 'friend' })
    const d = this._shareData
    if (d) {
      return {
        title: d.title,
        path: d.path
      }
    }
    return {
      title: '路路辣评 - 给最堵心的路段贴罚单',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    trackEvent('share', { type: 'timeline' })
    const d = this._shareData
    if (d) {
      return {
        title: d.title,
        query: d.path ? d.path.split('?')[1] || '' : ''
      }
    }
    return {
      title: '路路辣评 - 给最堵心的路段贴罚单'
    }
  },

  onShowShareCanvas() {
    this.setData({ showShareCanvas: true })
  },

  onHideShareCanvas() {
    this.setData({ showShareCanvas: false })
  }
})

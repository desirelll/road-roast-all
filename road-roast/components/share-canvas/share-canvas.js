const { callFunction } = require('../../utils/cloud')

Component({
  properties: {
    show: { type: Boolean, value: false },
    roadName: { type: String, value: '' },
    ticketCount: { type: Number, value: 0 },
    cityName: { type: String, value: '' },
    roadId: { type: String, value: '' }
  },

  data: {
    imageUrl: '',
    drawing: false
  },

  observers: {
    show(val) {
      if (val && this.properties.roadId) {
        this.drawShareImage()
      }
    }
  },

  methods: {
    async drawShareImage() {
      this.setData({ drawing: true, imageUrl: '' })
      const { roadName, ticketCount, cityName, roadId } = this.properties

      // 1. 获取小程序码
      let qrUrl = ''
      try {
        const qrRes = await callFunction('share-qrcode', { roadId }, { loading: false })
        if (qrRes.code === 0) qrUrl = qrRes.data.imageUrl
      } catch (e) {
        // 二维码生成失败不影响主流程
      }

      // 2. 获取 canvas 节点
      const query = this.createSelectorQuery()
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res || !res[0] || !res[0].node) {
            this.setData({ drawing: false })
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          const sysInfo = wx.getSystemInfoSync()
          const rpx = sysInfo.screenWidth / 750
          const dpr = sysInfo.pixelRatio || 2
          const W = 600 * rpx
          const H = 900 * rpx
          canvas.width = W * dpr
          canvas.height = H * dpr
          ctx.scale(dpr, dpr)

          // 3. 白色背景
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, W, H)

          // 4. 红色顶部
          const headerH = 180 * rpx
          ctx.fillStyle = '#E74C3C'
          ctx.fillRect(0, 0, W, headerH)

          ctx.fillStyle = '#FFFFFF'
          ctx.font = `bold ${36 * rpx}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('路路辣评', W / 2, 70 * rpx)

          ctx.font = `${24 * rpx}px sans-serif`
          ctx.fillText('给最堵心的路段贴罚单', W / 2, 130 * rpx)

          // 5. 路段名
          ctx.fillStyle = '#333333'
          ctx.font = `bold ${40 * rpx}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const displayName = roadName.length > 14 ? roadName.substring(0, 14) + '…' : roadName
          ctx.fillText(displayName, W / 2, 290 * rpx)

          // 6. 罚单数
          ctx.fillStyle = '#E74C3C'
          ctx.font = `bold ${100 * rpx}px sans-serif`
          ctx.fillText(String(ticketCount), W / 2, 440 * rpx)

          ctx.fillStyle = '#666666'
          ctx.font = `${30 * rpx}px sans-serif`
          ctx.fillText('张罚单', W / 2, 510 * rpx)

          // 城市名
          if (cityName) {
            ctx.fillStyle = '#999999'
            ctx.font = `${26 * rpx}px sans-serif`
            ctx.fillText(cityName, W / 2, 560 * rpx)
          }

          // 7. 小程序码
          const qrSize = 200 * rpx
          const qrX = (W - qrSize) / 2
          const qrY = 620 * rpx

          if (qrUrl) {
            try {
              const qrImg = canvas.createImage()
              await new Promise((resolve, reject) => {
                qrImg.onload = resolve
                qrImg.onerror = reject
                qrImg.src = qrUrl
              })
              ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
            } catch (e) {
              ctx.fillStyle = '#F5F5F5'
              ctx.fillRect(qrX, qrY, qrSize, qrSize)
            }
          } else {
            ctx.fillStyle = '#F5F5F5'
            ctx.fillRect(qrX, qrY, qrSize, qrSize)
          }

          // 8. 底部文案
          ctx.fillStyle = '#999999'
          ctx.font = `${22 * rpx}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('扫码查看路段详情', W / 2, 860 * rpx)

          // 9. 导出图片
          wx.canvasToTempFilePath({
            canvas,
            fileType: 'jpg',
            quality: 0.9,
            success: (res) => {
              this.setData({ imageUrl: res.tempFilePath, drawing: false })
            },
            fail: () => {
              this.setData({ drawing: false })
              wx.showToast({ title: '图片生成失败', icon: 'none' })
            }
          }, this)
        })
    },

    saveToAlbum() {
      const { imageUrl } = this.data
      if (!imageUrl) {
        wx.showToast({ title: '图片还在生成中', icon: 'none' })
        return
      }

      wx.saveImageToPhotosAlbum({
        filePath: imageUrl,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' })
          wx.showModal({
            title: '保存成功',
            content: '图片已保存到相册，去发朋友圈吧',
            confirmText: '知道了',
            showCancel: false
          })
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许访问相册，以便保存分享图片',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) wx.openSetting()
              }
            })
          } else {
            wx.showToast({ title: '保存失败，请重试', icon: 'none' })
          }
        }
      })
    },

    onClose() {
      this.setData({ imageUrl: '' })
      this.triggerEvent('close')
    }
  }
})

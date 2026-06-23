const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { roadId } = event

  if (!roadId) {
    return { code: -1, message: '缺少路段ID' }
  }

  const cloudPath = `qrcode/${roadId}.jpg`

  try {
    // 1. 检查云存储是否已有缓存
    try {
      const urlRes = await cloud.getTempFileURL({
        fileList: [cloudPath]
      })
      const fileInfo = urlRes.fileList[0]
      if (fileInfo.status === 0 && fileInfo.tempFileURL) {
        return {
          code: 0,
          data: { imageUrl: fileInfo.tempFileURL },
          message: 'ok'
        }
      }
    } catch (e) {
      // 缓存检查失败，继续生成
    }

    // 2. 生成小程序码
    const wxacodeRes = await cloud.openapi.wxacode.getUnlimited({
      scene: roadId,
      page: 'pages/road-detail/road-detail',
      width: 280
    })

    if (!wxacodeRes || !wxacodeRes.buffer) {
      return { code: -1, message: '小程序码生成失败' }
    }

    // 3. 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: wxacodeRes.buffer
    })

    // 4. 获取临时链接
    const urlRes = await cloud.getTempFileURL({
      fileList: [cloudPath]
    })
    const fileInfo = urlRes.fileList[0]

    return {
      code: 0,
      data: { imageUrl: fileInfo.tempFileURL },
      message: 'ok'
    }
  } catch (e) {
    console.error('share-qrcode error:', e)
    return { code: -1, message: '小程序码生成失败，请重试' }
  }
}

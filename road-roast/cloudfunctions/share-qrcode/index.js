const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { roadId } = event

  if (!roadId) {
    return { code: -1, message: '缺少路段ID' }
  }

  const cloudPath = `qrcode/${encodeURIComponent(roadId)}.jpg`

  try {
    // 1. 生成小程序码
    const wxacodeRes = await cloud.openapi.wxacode.getUnlimited({
      scene: `roadId=${encodeURIComponent(roadId)}`,
      page: 'pages/road-detail/road-detail',
      width: 280
    })

    if (!wxacodeRes || !wxacodeRes.buffer) {
      return { code: -1, message: '小程序码生成失败' }
    }

    // 2. 上传到云存储
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: wxacodeRes.buffer
    })

    // 3. 获取临时链接
    const urlRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
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

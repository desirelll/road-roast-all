/**
 * 云函数调用封装
 * 统一处理错误、loading、超时等通用逻辑
 */

const REQUEST_TIMEOUT = 15000 // 15 秒超时

// loading 引用计数，解决并发调用时 hideLoading 提前关闭的问题
let loadingCount = 0

const showLoading = (title = '加载中...') => {
  loadingCount++
  wx.showLoading({ title, mask: true })
}

const hideLoading = () => {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    wx.hideLoading()
  }
}

const forceHideLoading = () => {
  loadingCount = 0
  wx.hideLoading()
}

/**
 * 调用云函数
 * @param {string} name - 云函数名称
 * @param {object} data - 请求参数
 * @param {object} options
 * @param {boolean} options.loading - 是否展示 loading
 * @param {string} options.loadingTitle - loading 文案
 * @returns {Promise<{code: number, data: any, message: string}>}
 */
function callFunction(name, data = {}, options = {}) {
  const { loading = false, loadingTitle } = options

  if (loading) {
    showLoading(loadingTitle)
  }

  // 超时控制
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject({ errMsg: '请求超时，请重试' })
    }, REQUEST_TIMEOUT)
  })

  const requestPromise = wx.cloud.callFunction({ name, data }).then((res) => {
    const { result } = res
    if (!result || result.code !== 0) {
      wx.showToast({ title: result?.message || '请求失败', icon: 'none' })
      return Promise.reject({ ...(result || { errMsg: '云函数返回为空' }), _toastShown: true })
    }
    return result
  })

  return Promise.race([requestPromise, timeoutPromise])
    .finally(() => {
      clearTimeout(timer)
      if (loading) hideLoading()
    })
    .catch((err) => {
      const msg = err.errMsg || err.message || '网络异常，请重试'
      if (!err._toastShown) {
        wx.showToast({ title: msg, icon: 'none' })
      }
      return Promise.reject(err)
    })
}

/**
 * 安全的页面跳转，防止页面栈溢出
 * 微信小程序页面栈上限 10 层，接近上限时用 redirectTo 替代
 */
function safeNavigate(url) {
  const pages = getCurrentPages()
  if (pages.length >= 9) {
    wx.redirectTo({ url })
  } else {
    wx.navigateTo({ url })
  }
}

/**
 * 数据埋点（异步，不阻塞主流程）
 * @param {string} event - 事件名
 * @param {object} data - 附加数据
 */
function trackEvent(event, data = {}) {
  wx.cloud.callFunction({
    name: 'analytics',
    data: { event, data }
  }).catch(() => {})
}

module.exports = { callFunction, forceHideLoading, safeNavigate, trackEvent }

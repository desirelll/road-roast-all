/**
 * 云函数调用封装
 * 统一处理错误、loading 等通用逻辑
 */

const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true })
}

const hideLoading = () => {
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
  const { loading = true, loadingTitle } = options

  if (loading) {
    showLoading(loadingTitle)
  }

  return wx.cloud
    .callFunction({ name, data })
    .then((res) => {
      hideLoading()
      const { result } = res
      if (result.code !== 0) {
        wx.showToast({ title: result.message || '请求失败', icon: 'none' })
        return Promise.reject(result)
      }
      return result
    })
    .catch((err) => {
      hideLoading()
      const msg = err.errMsg || err.message || '网络异常，请重试'
      wx.showToast({ title: msg, icon: 'none' })
      return Promise.reject(err)
    })
}

module.exports = { callFunction }

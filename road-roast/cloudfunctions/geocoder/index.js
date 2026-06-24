const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TENCENT_MAP_KEY = process.env.TENCENT_MAP_KEY
const TENCENT_MAP_SK = process.env.TENCENT_MAP_SK

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { lat, lng } = event

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return { code: -1, message: '经纬度参数无效' }
  }

  try {
    const path = '/ws/geocoder/v1/'
    const params = {
      get_poi: '1',
      key: TENCENT_MAP_KEY,
      location: `${lat},${lng}`
    }
    const sig = sign(path, params, TENCENT_MAP_SK)
    const qs = buildQuery(params) + '&sig=' + sig

    const data = await new Promise((resolve, reject) => {
      const https = require('https')
      https.get(`https://apis.map.qq.com${path}?${qs}`, (resp) => {
        let body = ''
        resp.on('data', (chunk) => { body += chunk })
        resp.on('end', () => {
          try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    if (data.status === 0) {
      const addr = data.result
      const pois = addr.pois || []
      const roadName = pickRoadName(pois, addr)

      const component = addr.address_component || {}
      return {
        code: 0,
        data: {
          name: roadName,
          address: addr.address || '',
          province: component.province || '',
          city: component.city || '',
          lat,
          lng
        }
      }
    }

    console.error('geocoder API error:', JSON.stringify(data))
    return { code: -1, message: `地图API错误: ${data.status} ${data.message}` }
  } catch (e) {
    console.error('geocoder request error:', e)
    return { code: -1, message: '识别失败: ' + (e.message || '请重试') }
  }
}

// 从 POI 和地址中提取路名
function pickRoadName(pois, addr) {
  // 1. 优先找 category 含"道路"的 POI
  const roadPoi = pois.find((p) => p.category && p.category.includes('道路'))
  if (roadPoi) return roadPoi.title

  // 2. 从 address 中正则提取路名（如"广东省广州市越秀区解放北路" → "解放北路"）
  const match = addr.address?.match(/[一-龥]+(?:路|街|道|巷|弄|胡同)/)
  if (match) return match[0]

  // 3. 从 recommend 取：仅当它本身是路名（末尾是路名关键词，而非建筑名的一部分）
  const recommend = addr.formatted_addresses?.recommend
  if (recommend && /[一-龥]+(?:路|街|道|巷|弄|胡同)$/.test(recommend)) return recommend

  // 4. 兜底
  return recommend || addr.address || '未知路段'
}

// URL 参数拼接（带编码）
function buildQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
}

// 签名用参数拼接（不编码，原始值）
function buildRawQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

// 腾讯地图签名：MD5(path?rawParams+SK)
function sign(path, params, sk) {
  return crypto.createHash('md5').update(path + '?' + buildRawQuery(params) + sk).digest('hex')
}

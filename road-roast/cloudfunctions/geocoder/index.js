const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const TENCENT_MAP_KEY = 'IEABZ-35CCW-DOMR7-3SOW2-YUWDH-DVBIS'
const TENCENT_MAP_SK = 'kpWoRdBZq5GwihV4M1SA7qYsbM8qdfaT'

exports.main = async (event, context) => {
  const { lat, lng } = event

  if (!lat || !lng) {
    return { code: -1, message: '缺少经纬度参数' }
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
      const roadName = pois.length > 0 ? pois[0].title : (addr.formatted_addresses?.recommend || addr.address)

      return {
        code: 0,
        data: {
          name: roadName,
          address: addr.address,
          province: addr.address_component.province,
          city: addr.address_component.city,
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

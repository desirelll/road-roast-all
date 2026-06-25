const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 内存缓存：{ keyword: { results, expireAt } }
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

const TENCENT_MAP_KEY = process.env.TENCENT_MAP_KEY
const TENCENT_MAP_SK = process.env.TENCENT_MAP_SK

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    return { code: -1, message: '未授权' }
  }

  const { keyword } = event

  if (!keyword || !keyword.trim()) {
    return { code: -1, message: '请输入搜索关键词' }
  }

  const kw = keyword.trim()

  const cached = cache.get(kw)
  if (cached && cached.expireAt > Date.now()) {
    return { code: 0, data: cached.results, message: 'ok' }
  }

  try {
    const [poiResults, localRoads] = await Promise.all([
      searchTencentPOI(kw),
      searchLocalRoads(kw)
    ])

    const localByName = new Map()
    const localByCityName = new Map()
    localRoads.forEach((r) => {
      localByName.set(r.name, r)
      localByCityName.set(`${r.city || ''}_${r.name}`, r)
    })

    const merged = poiResults.map((item) => {
      const localRoad = localByCityName.get(`${item.city || ''}_${item.title}`)
        || localByName.get(item.title)
      return {
        id: localRoad ? localRoad._id : item.id,
        roadId: localRoad ? localRoad._id : null,
        name: item.title,
        address: item.address,
        province: item.province || '',
        city: item.city || '',
        location: item.location,
        ticketCount: localRoad ? localRoad.totalTickets || 0 : 0,
        isExisting: Boolean(localRoad)
      }
    })

    localRoads.forEach((r) => {
      if (!merged.find((m) => m.name === r.name && m.city === r.city)) {
        merged.push({
          id: r._id,
          roadId: r._id,
          name: r.name,
          address: r.fullName || '',
          province: r.province || '',
          city: r.city || '',
          location: formatLocation(r.location),
          ticketCount: r.totalTickets || 0,
          isExisting: true
        })
      }
    })

    cache.set(kw, { results: merged, expireAt: Date.now() + CACHE_TTL })

    return { code: 0, data: merged, message: 'ok' }
  } catch (e) {
    console.error('road-search error:', e)
    const localRoads = await searchLocalRoads(kw)
    const fallback = localRoads.map((r) => ({
      id: r._id,
      roadId: r._id,
      name: r.name,
      address: r.fullName || '',
      province: r.province || '',
      city: r.city || '',
      location: formatLocation(r.location),
      ticketCount: r.totalTickets || 0,
      isExisting: true
    }))
    return { code: 0, data: fallback, message: 'ok' }
  }
}

/**
 * 调用腾讯地图 POI 搜索
 */
async function searchTencentPOI(keyword) {
  const path = '/ws/place/v1/search'
  const params = {
    boundary: 'region(全国,0)',
    key: TENCENT_MAP_KEY,
    keyword,
    page_size: '15'
  }
  const sig = sign(path, params, TENCENT_MAP_SK)
  const qs = buildQuery(params) + '&sig=' + sig

  try {
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

    if (data.status === 0 && data.data) {
      return data.data.map((item) => ({
        id: item.id,
        title: item.title,
        address: item.address,
        province: item.ad_info?.province || '',
        city: item.ad_info?.city || '',
        location: item.location,
        category: item.category
      }))
    }

    console.error('POI API error:', JSON.stringify(data))
  } catch (e) {
    console.error('POI request error:', e)
  }

  return []
}

/**
 * 正则转义，防止 ReDoS
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 查本地 Road 表，模糊匹配路段名
 */
async function searchLocalRoads(keyword) {
  try {
    const res = await db.collection('Road')
      .where({
        name: db.RegExp({
          regexp: escapeRegExp(keyword),
          options: 'i'
        })
      })
      .orderBy('totalTickets', 'desc')
      .limit(10)
      .get()
    return res.data
  } catch (e) {
    return []
  }
}

function formatLocation(location) {
  if (!location) return null
  const lat = location.lat ?? location.latitude ?? location._latitude
  const lng = location.lng ?? location.longitude ?? location._longitude
  if (lat === undefined || lng === undefined) return null
  return { lat, lng }
}

function buildQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
}

function buildRawQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

function sign(path, params, sk) {
  return crypto.createHash('md5').update(path + '?' + buildRawQuery(params) + sk).digest('hex')
}

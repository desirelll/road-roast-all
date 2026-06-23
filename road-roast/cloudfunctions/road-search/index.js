const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 内存缓存：{ keyword: { results, expireAt } }
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

const TENCENT_MAP_KEY = 'IEABZ-35CCW-DOMR7-3SOW2-YUWDH-DVBIS'
const TENCENT_MAP_SK = 'kpWoRdBZq5GwihV4M1SA7qYsbM8qdfaT'

exports.main = async (event, context) => {
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

    const localMap = new Map()
    localRoads.forEach((r) => {
      localMap.set(r.name, r.totalTickets || 0)
    })

    const merged = poiResults.map((item) => ({
      id: item.id,
      name: item.title,
      address: item.address,
      province: item.province || '',
      city: item.city || '',
      location: item.location,
      ticketCount: localMap.get(item.title) || 0,
      isExisting: localMap.has(item.title)
    }))

    localRoads.forEach((r) => {
      if (!merged.find((m) => m.name === r.name)) {
        merged.push({
          id: r._id,
          name: r.name,
          address: r.fullName || '',
          province: r.province || '',
          city: r.city || '',
          location: r.location
            ? { lat: r.location.lat, lng: r.location.lng }
            : null,
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
      name: r.name,
      address: r.fullName || '',
      province: r.province || '',
      city: r.city || '',
      location: r.location
        ? { lat: r.location.lat, lng: r.location.lng }
        : null,
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
 * 查本地 Road 表，模糊匹配路段名
 */
async function searchLocalRoads(keyword) {
  try {
    const res = await db.collection('Road')
      .where({
        name: db.RegExp({
          regexp: keyword,
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

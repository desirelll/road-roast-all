const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

test('homepage hot markers read road-ranking list payload', () => {
  const source = read('road-roast/pages/index/index.js')
  assert.match(source, /const roads = \(res\.data\.list \|\| \[\]\)\.filter/)
  assert.doesNotMatch(source, /res\.data\.filter\(/)
})

test('road-ranking returns location for homepage markers', () => {
  const source = read('road-roast/cloudfunctions/road-ranking/index.js')
  assert.match(source, /location:\s*formatLocation\(item\.location\)/)
  assert.match(source, /location:\s*formatLocation\(item\.road\.location\)/)
})

test('road-search keeps local Road id separate from Tencent POI id', () => {
  const source = read('road-roast/cloudfunctions/road-search/index.js')
  assert.match(source, /roadId:\s*localRoad\s*\?\s*localRoad\._id\s*:\s*null/)
  assert.match(source, /id:\s*localRoad\s*\?\s*localRoad\._id\s*:\s*item\.id/)
})

test('ticket-create does not replace User documents while incrementing totals', () => {
  const source = read('road-roast/cloudfunctions/ticket-create/index.js')
  assert.doesNotMatch(source, /where\(\{\s*openid\s*\}\)\.set\(/)
  assert.match(source, /updateUserTotalTickets/)
})

test('share qrcode scene is compatible with road detail page options', () => {
  const qrcode = read('road-roast/cloudfunctions/share-qrcode/index.js')
  const detail = read('road-roast/pages/road-detail/road-detail.js')
  assert.match(qrcode, /scene:\s*`roadId=\$\{encodeURIComponent\(roadId\)\}`/)
  assert.match(qrcode, /uploadRes\.fileID/)
  assert.match(detail, /parseScene/)
})

test('callFunction only shows one toast for business errors', () => {
  const source = read('road-roast/utils/cloud.js')
  assert.match(source, /_toastShown:\s*true/)
  assert.match(source, /if \(!err\._toastShown\)/)
})

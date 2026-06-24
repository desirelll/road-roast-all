const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const indexWxml = fs.readFileSync(
  path.join(__dirname, '../road-roast/pages/index/index.wxml'),
  'utf8'
)

test('location fallback is not coupled to nearby roads visibility', () => {
  assert.equal(
    indexWxml.includes('class="map-placeholder" wx:else'),
    false,
    'map-placeholder must not be the wx:else branch of nearby-section'
  )
})

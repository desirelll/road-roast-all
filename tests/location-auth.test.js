const test = require('node:test')
const assert = require('node:assert/strict')

const { isLocationDenied, shouldGuideLocationSetting } = require('../road-roast/utils/location-auth')

test('isLocationDenied detects common WeChat denial messages', () => {
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail auth deny' }), true)
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail authorize no response' }), true)
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail system permission denied' }), true)
})

test('isLocationDenied ignores non-permission failures', () => {
  assert.equal(isLocationDenied({ errMsg: 'getLocation:fail timeout' }), false)
  assert.equal(isLocationDenied({}), false)
})

test('shouldGuideLocationSetting only guides after explicit denial', () => {
  assert.equal(shouldGuideLocationSetting({ 'scope.userLocation': false }), true)
  assert.equal(shouldGuideLocationSetting({ 'scope.userLocation': true }), false)
  assert.equal(shouldGuideLocationSetting({}), false)
})

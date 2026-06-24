function isLocationDenied(err = {}) {
  const msg = err.errMsg || ''
  return msg.includes('auth deny')
    || msg.includes('authorize no response')
    || msg.includes('system permission denied')
}

function shouldGuideLocationSetting(authSetting = {}) {
  return authSetting['scope.userLocation'] === false
}

module.exports = { isLocationDenied, shouldGuideLocationSetting }

import defaultSiteConfig from '../data/siteConfig'
import { accessoryRecords as defaultAccessoryRecords } from '../data/accessories'

export function loadSiteContent() {
  return getDefaultSiteContent()
}

export function persistSiteContent() {
  return false
}

export function clearSiteContentCache() {
  return false
}

export function getDefaultSiteContent() {
  return {
    siteConfig: cloneValue(defaultSiteConfig),
    accessoryRecords: cloneValue(defaultAccessoryRecords),
  }
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

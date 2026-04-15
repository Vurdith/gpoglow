import { useEffect, useMemo, useState } from 'react'
import defaultSiteConfig from '../data/siteConfig'
import { accessoryRecords as defaultAccessoryRecords, hydrateAccessories } from '../data/accessories'
import { fetchRemoteSiteContent } from '../lib/siteContentApi'
import { SiteContentContext } from './siteContentContext'

export function SiteContentProvider({ children }) {
  const [siteConfig, setSiteConfig] = useState(() => cloneValue(defaultSiteConfig))
  const [accessoryRecords, setAccessoryRecords] = useState(() => cloneValue(defaultAccessoryRecords))
  const [storageMode, setStorageMode] = useState('Bundled defaults')

  useEffect(() => {
    let cancelled = false

    fetchRemoteSiteContent()
      .then((remoteContent) => {
        if (cancelled) return

        setSiteConfig(remoteContent.siteConfig)
        setAccessoryRecords(remoteContent.accessoryRecords)
        setStorageMode('Server database')
      })
      .catch(() => {
        if (!cancelled) {
          setStorageMode('Bundled defaults')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const accessories = useMemo(() => hydrateAccessories(accessoryRecords), [accessoryRecords])

  const value = useMemo(
    () => ({
      siteConfig,
      setSiteConfig,
      accessoryRecords,
      setAccessoryRecords,
      accessories,
      storageMode,
    }),
    [siteConfig, accessoryRecords, accessories, storageMode],
  )

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

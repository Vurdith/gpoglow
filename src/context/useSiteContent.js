import { useContext } from 'react'
import { SiteContentContext } from './siteContentContext'

export function useSiteContent() {
  const context = useContext(SiteContentContext)

  if (!context) {
    throw new Error('useSiteContent must be used within SiteContentProvider')
  }

  return context
}

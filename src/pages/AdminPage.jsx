import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteContent } from '../context/useSiteContent'
import { fetchAdminStatus, lockAdminSession, setAdminPassword, verifyAdminPassword } from '../lib/adminAuth'
import { fetchRemoteSiteContent, saveRemoteSiteContent, uploadAdminImage } from '../lib/siteContentApi'
import { AVAILABILITY, RARITIES, SLOTS, STAT_DEFINITIONS, STAT_LABELS } from '../data/accessories'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'site', label: 'Site copy' },
  { key: 'accessories', label: 'Accessories' },
]

const SITE_FIELDS = [
  { key: 'brandName', label: 'Brand name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'accessoriesIntro', label: 'Accessories intro', multiline: true },
  { key: 'simulatorIntroPrimary', label: 'Simulator intro 1', multiline: true },
  { key: 'simulatorIntroSecondary', label: 'Simulator intro 2', multiline: true },
  { key: 'footerPrimary', label: 'Footer line 1' },
  { key: 'footerSecondary', label: 'Footer line 2' },
]

const FILTER_ALL = 'All'

const sortLabels = {
  name: 'Name',
  rarity: 'Rarity',
  slot: 'Slot',
  availability: 'Availability',
  ...STAT_LABELS,
}

const DEFAULT_CROP_ZOOM = 1.1
const MIN_CROP_AXIS = -100
const MAX_CROP_AXIS = 200

export default function AdminPage() {
  const { siteConfig, setSiteConfig, accessoryRecords, setAccessoryRecords, storageMode } = useSiteContent()
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [setupPassword, setSetupPasswordState] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupError, setSetupError] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [siteDraft, setSiteDraft] = useState(siteConfig)
  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState(FILTER_ALL)
  const [rarityFilter, setRarityFilter] = useState(FILTER_ALL)
  const [availabilityFilter, setAvailabilityFilter] = useState(FILTER_ALL)
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [selectedId, setSelectedId] = useState(accessoryRecords[0]?.id || null)
  const [draft, setDraft] = useState(() => createDraft(accessoryRecords[0]))
  const [imageCrop, setImageCrop] = useState(null)
  const [importError, setImportError] = useState('')
  const [toast, setToast] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAdminStatus() {
      try {
        const status = await fetchAdminStatus()
        if (cancelled) return

        setNeedsSetup(!status.configured)
        setUnlocked(Boolean(status.authenticated))
      } catch (error) {
        if (cancelled) return

        setNeedsSetup(false)
        setUnlocked(false)
        setToast({
          message: error instanceof Error ? error.message : 'Could not check admin status.',
          type: 'error',
        })
      } finally {
        if (!cancelled) {
          setReady(true)
        }
      }
    }

    loadAdminStatus()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSiteDraft(siteConfig)
  }, [siteConfig])

  useEffect(() => {
    if (!accessoryRecords.length) {
      setSelectedId(null)
      setDraft(createBlankAccessory())
      return
    }

    if (!selectedId || !accessoryRecords.some((record) => record.id === selectedId)) {
      setSelectedId(accessoryRecords[0].id)
    }
  }, [accessoryRecords, selectedId])

  useEffect(() => {
    const selectedRecord = accessoryRecords.find((record) => record.id === selectedId)
    if (selectedRecord) {
      setDraft(createDraft(selectedRecord))
      setImageCrop(null)
    }
  }, [selectedId, accessoryRecords])

  useEffect(() => {
    if (!toast) return undefined

    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const pushToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  const saveContent = async ({ nextSiteConfig = siteConfig, nextAccessoryRecords = accessoryRecords, message, type = 'success' }) => {
    setIsSaving(true)

    try {
      const preparedAccessoryRecords = await prepareAccessoryRecordsForSave(nextAccessoryRecords)
      const savedContent = await saveRemoteSiteContent({
        siteConfig: nextSiteConfig,
        accessoryRecords: preparedAccessoryRecords,
      })

      setSiteConfig(savedContent.siteConfig)
      setAccessoryRecords(savedContent.accessoryRecords)

      if (message) {
        pushToast(message, type)
      }

      return savedContent
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.'
      if (message.toLowerCase().includes('admin login required')) {
        setUnlocked(false)
      }

      pushToast(message, 'error')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const filteredAccessories = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const direction = sortDirection === 'asc' ? 1 : -1

    return accessoryRecords
      .filter((record) => {
        const matchesSearch = !normalized
          || record.name?.toLowerCase().includes(normalized)
          || record.id?.toLowerCase().includes(normalized)

        if (!matchesSearch) return false
        if (slotFilter !== FILTER_ALL && record.slot !== slotFilter) return false
        if (rarityFilter !== FILTER_ALL && record.rarity !== rarityFilter) return false
        if (availabilityFilter !== FILTER_ALL && record.availability !== availabilityFilter) return false

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '') * direction
        if (sortBy === 'rarity') return (RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)) * direction
        if (sortBy === 'slot') return (SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)) * direction
        if (sortBy === 'availability') return (AVAILABILITY.indexOf(a.availability) - AVAILABILITY.indexOf(b.availability)) * direction
        if (STAT_LABELS[sortBy]) return (getRecordStatValue(a, sortBy) - getRecordStatValue(b, sortBy)) * direction
        return 0
      })
  }, [accessoryRecords, availabilityFilter, rarityFilter, search, slotFilter, sortBy, sortDirection])

  const hasAccessoryFilters = search
    || slotFilter !== FILTER_ALL
    || rarityFilter !== FILTER_ALL
    || availabilityFilter !== FILTER_ALL
    || sortBy !== 'name'
    || sortDirection !== 'asc'

  if (!ready) {
    return <AdminShell title="Admin panel" toast={toast}>Loading admin tools...</AdminShell>
  }

  if (needsSetup) {
    return (
      <AdminShell title="Set admin password" toast={toast}>
        <div className="admin-auth-card">
          <p className="text-sm text-dark-300 leading-6">
            Set the real admin password here. It will be saved on the server and checked by the API before any content can be changed.
          </p>

          <label className="field-shell mt-5">
            <span className="field-label">New password</span>
            <input type="password" value={setupPassword} onChange={(event) => setSetupPasswordState(event.target.value)} />
          </label>

          <label className="field-shell mt-4">
            <span className="field-label">Confirm password</span>
            <input type="password" value={setupConfirm} onChange={(event) => setSetupConfirm(event.target.value)} />
          </label>

          {setupError ? <p className="mt-4 text-sm text-gpo-red">{setupError}</p> : null}

          <button
            type="button"
            className="scrap-action mt-5 w-full"
            onClick={async () => {
              if (setupPassword.length < 8) {
                setSetupError('Use at least 8 characters.')
                return
              }

              if (setupPassword !== setupConfirm) {
                setSetupError('Passwords do not match.')
                return
              }

              try {
                setSetupError('')
                await setAdminPassword(setupPassword)
                setNeedsSetup(false)
                setUnlocked(true)
                pushToast('Admin password saved on the server.')
              } catch (error) {
                setSetupError(error instanceof Error ? error.message : 'Could not save the admin password.')
              }
            }}
          >
            Save password and open admin
          </button>
        </div>
      </AdminShell>
    )
  }

  if (!unlocked) {
    return (
      <AdminShell title="Admin login" toast={toast}>
        <div className="admin-auth-card">
          <p className="text-sm text-dark-300 leading-6">Enter your admin password to manage site content.</p>

          <label className="field-shell mt-5">
            <span className="field-label">Password</span>
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>

          {loginError ? <p className="mt-4 text-sm text-gpo-red">{loginError}</p> : null}

          <button
            type="button"
            className="scrap-action mt-5 w-full"
            onClick={async () => {
              try {
                await verifyAdminPassword(loginPassword)
                setLoginError('')
                setUnlocked(true)
              } catch (error) {
                setLoginError(error instanceof Error ? error.message : 'Wrong password.')
              }
            }}
          >
            Unlock admin
          </button>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="Admin panel" toast={toast}>
      <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <aside className="panel-frame p-5 sm:p-6 h-fit">
          <div className="accent-hand text-xl text-dark-100">Modules</div>
          <div className="scrap-tabs mt-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`scrap-tab w-full text-left ${activeTab === tab.key ? 'scrap-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="scrap-action w-full"
              onClick={async () => {
                await lockAdminSession()
                setUnlocked(false)
                pushToast('Admin locked.')
              }}
            >
              Lock admin
            </button>
            <Link to="/" className="scrap-action inline-flex justify-center w-full">Back to site</Link>
          </div>
        </aside>

        <section className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="panel-frame p-6 sm:p-7">
                <div className="accent-hand text-2xl text-dark-100">Site control</div>
                <p className="mt-3 text-dark-300 leading-7">
                  This admin panel is set up to own the site over time, not just accessories. Right now it handles global copy, accessory CRUD, image upload + crop, JSON import/export, and server-backed saves through the API.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="stat-ticket">
                    <div className="ticket-label">Accessories</div>
                    <div className="ticket-value">{accessoryRecords.length}</div>
                  </div>
                  <div className="stat-ticket">
                    <div className="ticket-label">Editable modules</div>
                    <div className="ticket-value">2</div>
                  </div>
                  <div className="stat-ticket">
                    <div className="ticket-label">Storage mode</div>
                    <div className="ticket-value text-xl sm:text-2xl">{storageMode}</div>
                  </div>
                </div>
              </div>

              <div className="panel-frame p-6 sm:p-7 space-y-4">
                <div className="accent-hand text-xl text-dark-100">Backup and transfer</div>
                <p className="text-sm text-dark-300 leading-6">
                  Export your current admin-managed content as JSON, or import a prior backup to restore/edit it.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" className="scrap-action" onClick={() => exportContent({ siteConfig, accessoryRecords })}>
                    Export content JSON
                  </button>
                  <button
                    type="button"
                    className="scrap-mini"
                    onClick={async () => {
                      try {
                        const remoteContent = await fetchRemoteSiteContent()
                        setSiteConfig(remoteContent.siteConfig)
                        setAccessoryRecords(remoteContent.accessoryRecords)
                        pushToast('Reloaded content from the database.')
                      } catch (error) {
                        pushToast(error instanceof Error ? error.message : 'Could not reload the database content.', 'error')
                      }
                    }}
                  >
                    Reload from database
                  </button>
                  <button type="button" className="scrap-mini" onClick={() => importInputRef.current?.click()}>
                    Import content JSON
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return

                      try {
                        const imported = JSON.parse(await file.text())
                        const nextSiteConfig = imported.siteConfig ? { ...siteConfig, ...imported.siteConfig } : siteConfig
                        const nextAccessoryRecords = Array.isArray(imported.accessoryRecords) ? imported.accessoryRecords : accessoryRecords

                        const savedContent = await saveContent({
                          nextSiteConfig,
                          nextAccessoryRecords,
                          message: 'Imported content JSON.',
                        })

                        setImportError(savedContent ? '' : 'That JSON file could not be saved to the database.')
                      } catch {
                        setImportError('That JSON file could not be read or saved.')
                      } finally {
                        event.target.value = ''
                      }
                    }}
                  />
                </div>

                {importError ? <p className="text-sm text-gpo-red">{importError}</p> : null}
              </div>
            </div>
          )}

          {activeTab === 'site' && (
            <div className="panel-frame p-6 sm:p-7 space-y-4">
              <div className="accent-hand text-2xl text-dark-100">Global site copy</div>
              <p className="text-sm text-dark-300 leading-6">Edit shared site text here so the header, footer, accessories page, and simulator all stay in sync.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SITE_FIELDS.map((field) => (
                  <label key={field.key} className={`field-shell ${field.multiline ? 'md:col-span-2' : ''}`}>
                    <span className="field-label">{field.label}</span>
                    {field.multiline ? (
                      <textarea
                        rows={4}
                        value={siteDraft[field.key] || ''}
                        onChange={(event) => setSiteDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={siteDraft[field.key] || ''}
                        onChange={(event) => setSiteDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="scrap-action"
                disabled={isSaving}
                onClick={async () => {
                  await saveContent({
                    nextSiteConfig: { ...siteDraft },
                    message: 'Saved site copy changes.',
                  })
                }}
              >
                {isSaving ? 'Saving...' : 'Save site copy'}
              </button>
            </div>
          )}

          {activeTab === 'accessories' && (
            <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
              <div className="panel-frame p-5 sm:p-6 space-y-4 h-fit xl:sticky xl:top-24">
                <div className="accent-hand text-xl text-dark-100">Accessories</div>
                <label className="field-shell">
                  <span className="field-label">Search records</span>
                  <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cupid Wing, bat_swarm..." />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <FormField label="Slot" select>
                    <select value={slotFilter} onChange={(event) => setSlotFilter(event.target.value)}>
                      <option value={FILTER_ALL}>All slots</option>
                      {SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Availability" select>
                    <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
                      <option value={FILTER_ALL}>All records</option>
                      {AVAILABILITY.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Rarity" select>
                    <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
                      <option value={FILTER_ALL}>All rarities</option>
                      {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Sort field" select>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Direction" select className="sm:col-span-2 xl:col-span-1">
                    <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
                      <option value="asc">Ascending / Lowest first</option>
                      <option value="desc">Descending / Highest first</option>
                    </select>
                  </FormField>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-dark-300">
                  <span>{filteredAccessories.length} of {accessoryRecords.length} records • {sortDirection === 'desc' ? 'Highest first' : 'Lowest first'} by {sortLabels[sortBy]}</span>
                  {hasAccessoryFilters ? (
                    <button
                      type="button"
                      className="scrap-mini"
                      onClick={() => {
                        setSearch('')
                        setSlotFilter(FILTER_ALL)
                        setRarityFilter(FILTER_ALL)
                        setAvailabilityFilter(FILTER_ALL)
                        setSortBy('name')
                        setSortDirection('asc')
                      }}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="scrap-action flex-1"
                    onClick={() => {
                      const blank = createBlankAccessory()
                      setDraft(createDraft(blank))
                      setSelectedId(null)
                      setImageCrop(null)
                    }}
                  >
                    Add new
                  </button>
                  <button
                    type="button"
                    className="scrap-action flex-1"
                    onClick={() => {
                      if (!draft) return
                      const duplicate = createDraft(toRecord(draft))
                      duplicate.id = `${duplicate.id || slugify(duplicate.name || 'accessory')}-copy`
                      duplicate.name = duplicate.name ? `${duplicate.name} Copy` : 'New Accessory Copy'
                      setDraft(duplicate)
                      setSelectedId(null)
                      setImageCrop(null)
                    }}
                  >
                    Duplicate
                  </button>
                </div>

                <div className="admin-list max-h-[540px] overflow-auto space-y-2 pr-1">
                  {filteredAccessories.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className={`admin-list-item ${selectedId === record.id ? 'admin-list-item-active' : ''}`}
                      onClick={() => setSelectedId(record.id)}
                    >
                      <span className="block text-sm font-semibold text-dark-100 truncate">{record.name}</span>
                      <span className="block mt-1 text-xs text-dark-400 truncate">{record.id}</span>
                      <span className="block mt-1 text-[11px] text-dark-400 truncate">{record.slot} • {record.rarity} • {record.availability}</span>
                    </button>
                  ))}
                  {filteredAccessories.length === 0 ? (
                    <div className="admin-list-empty">No accessories match the current filters.</div>
                  ) : null}
                </div>
              </div>

              <div className="panel-frame p-6 sm:p-7 space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="accent-hand text-2xl text-dark-100">{draft.name || 'New accessory'}</div>
                    <p className="mt-2 text-sm text-dark-300">Edit every current accessory field, plus upload and crop an icon image for the card frame.</p>
                  </div>
                  {selectedId ? (
                    <button
                      type="button"
                      className="scrap-mini"
                      disabled={isSaving}
                      onClick={async () => {
                        const confirmed = window.confirm(`Delete ${draft.name || 'this accessory'}?`)
                        if (!confirmed) return

                        const nextAccessoryRecords = accessoryRecords.filter((record) => record.id !== selectedId)
                        const savedContent = await saveContent({
                          nextAccessoryRecords,
                          message: 'Deleted accessory.',
                        })
                        if (!savedContent) return

                        setSelectedId(null)
                        setDraft(createBlankAccessory())
                      }}
                    >
                      Delete record
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="ID">
                    <input type="text" value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
                  </FormField>
                  <FormField label="Name">
                    <input type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                  </FormField>
                  <FormField label="Slot" select>
                    <select value={draft.slot} onChange={(event) => setDraft((current) => ({ ...current, slot: event.target.value }))}>
                      {SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Rarity" select>
                    <select value={draft.rarity} onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value }))}>
                      {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Availability" select>
                    <select value={draft.availability} onChange={(event) => setDraft((current) => ({ ...current, availability: event.target.value }))}>
                      {AVAILABILITY.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Trade level">
                    <input
                      type="number"
                      value={draft.requirements.tradeLevel}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        requirements: { ...current.requirements, tradeLevel: event.target.value },
                      }))}
                    />
                  </FormField>
                  <FormField label="Caption" multiline className="md:col-span-2">
                    <textarea rows={3} value={draft.caption} onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))} />
                  </FormField>
                  <FormField label="Description" multiline className="md:col-span-2">
                    <textarea rows={5} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                  </FormField>
                </div>

                <div className="panel-frame-soft p-5 space-y-4">
                  <div className="accent-hand text-xl text-dark-100">Source fields</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Source summary" multiline className="md:col-span-2">
                      <textarea rows={3} value={draft.source.summary} onChange={(event) => setDraft((current) => ({ ...current, source: { ...current.source, summary: event.target.value } }))} />
                    </FormField>
                    <FormField label="Dropped by / obtained from">
                      <input type="text" value={draft.source.by} onChange={(event) => setDraft((current) => ({ ...current, source: { ...current.source, by: event.target.value } }))} />
                    </FormField>
                    <FormField label="Location / island">
                      <input type="text" value={draft.source.location} onChange={(event) => setDraft((current) => ({ ...current, source: { ...current.source, location: event.target.value } }))} />
                    </FormField>
                    <FormField label="Drop chance">
                      <input type="text" value={draft.source.dropChance} onChange={(event) => setDraft((current) => ({ ...current, source: { ...current.source, dropChance: event.target.value } }))} />
                    </FormField>
                    <FormField label="Extra source detail">
                      <input type="text" value={draft.source.detail} onChange={(event) => setDraft((current) => ({ ...current, source: { ...current.source, detail: event.target.value } }))} />
                    </FormField>
                  </div>
                </div>

                <div className="panel-frame-soft p-5 space-y-4">
                  <div className="accent-hand text-xl text-dark-100">Image icon</div>
                  <p className="text-sm text-dark-300 leading-6">Upload an accessory icon, crop it into the square frame, then send it to Supabase Storage and save the public URL in the record.</p>

                  <div className="admin-image-row">
                    <div className="admin-image-preview">
                      {draft.image ? <img src={draft.image} alt={draft.name || 'Accessory preview'} /> : <span>No image</span>}
                    </div>

                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap gap-3">
                        <button type="button" className="scrap-action" onClick={() => fileInputRef.current?.click()}>
                          Upload image
                        </button>
                        <button
                          type="button"
                          className="scrap-mini"
                          onClick={() => {
                            setDraft((current) => ({ ...current, image: '' }))
                            setImageCrop(null)
                          }}
                        >
                          Clear image
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const src = await fileToDataUrl(file)
                          const image = await loadImage(src)
                          setImageCrop({
                            src,
                            zoom: DEFAULT_CROP_ZOOM,
                            focusX: 50,
                            focusY: 50,
                            width: image.width,
                            height: image.height,
                          })
                          event.target.value = ''
                        }}
                      />

                      {imageCrop ? (
                        <div className="panel-frame-soft p-4 space-y-4">
                          <div className="admin-crop-frame">
                            <img
                              src={imageCrop.src}
                              alt="Crop preview"
                              style={getCropPreviewStyle(imageCrop)}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField label={`Zoom (${imageCrop.zoom.toFixed(2)}x)`} className="md:col-span-2">
                              <div className="admin-range-stack">
                                <input
                                  type="range"
                                  className="admin-range-slider"
                                  min={DEFAULT_CROP_ZOOM}
                                  max="2.4"
                                  step="0.05"
                                  value={imageCrop.zoom}
                                  onChange={(event) => setImageCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
                                />
                                <div className="admin-range-value">{imageCrop.zoom.toFixed(2)}x</div>
                              </div>
                            </FormField>
                            <FormField label={`Focus X (${imageCrop.focusX}%)`}>
                              <div className="admin-range-stack">
                                <div className="admin-range-inline">
                                  <input
                                    type="range"
                                    className="admin-range-slider"
                                    min={MIN_CROP_AXIS}
                                    max={MAX_CROP_AXIS}
                                    step="1"
                                    value={imageCrop.focusX}
                                    onChange={(event) => setImageCrop((current) => ({ ...current, focusX: Number(event.target.value) }))}
                                  />
                                  <input
                                    type="number"
                                    className="admin-range-number"
                                    min={MIN_CROP_AXIS}
                                    max={MAX_CROP_AXIS}
                                    step="1"
                                    value={imageCrop.focusX}
                                    onChange={(event) => setImageCrop((current) => ({ ...current, focusX: Number(event.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                            </FormField>
                            <FormField label={`Focus Y (${imageCrop.focusY}%)`}>
                              <div className="admin-range-stack">
                                <div className="admin-range-inline">
                                  <input
                                    type="range"
                                    className="admin-range-slider"
                                    min={MIN_CROP_AXIS}
                                    max={MAX_CROP_AXIS}
                                    step="1"
                                    value={imageCrop.focusY}
                                    onChange={(event) => setImageCrop((current) => ({ ...current, focusY: Number(event.target.value) }))}
                                  />
                                  <input
                                    type="number"
                                    className="admin-range-number"
                                    min={MIN_CROP_AXIS}
                                    max={MAX_CROP_AXIS}
                                    step="1"
                                    value={imageCrop.focusY}
                                    onChange={(event) => setImageCrop((current) => ({ ...current, focusY: Number(event.target.value) || 0 }))}
                                  />
                                </div>
                              </div>
                            </FormField>
                          </div>

                          <button
                            type="button"
                            className="scrap-action"
                            onClick={async () => {
                              const cropped = await cropImageSquare(imageCrop)
                              setDraft((current) => ({ ...current, image: cropped }))
                              setImageCrop(null)
                              pushToast('Crop applied. Save the accessory to upload it and keep it.')
                            }}
                          >
                            Apply crop
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="panel-frame-soft p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="accent-hand text-xl text-dark-100">Stats</div>
                    <button
                      type="button"
                      className="scrap-mini"
                      onClick={() => setDraft((current) => ({
                        ...current,
                        stats: [...current.stats, { key: 'hp', value: 0, scaling: { note: '' } }],
                      }))}
                    >
                      Add stat
                    </button>
                  </div>

                  <div className="space-y-3">
                    {draft.stats.map((stat, index) => {
                      const statDefinition = STAT_DEFINITIONS[stat.key]
                      const statColor = statDefinition?.color || 'var(--color-dark-300)'

                      return (
                        <div key={`${stat.key}-${index}`} className="admin-stat-row" style={{ '--stat-color': statColor }}>
                          <div className="admin-stat-inputs">
                            <div className="admin-select-shell admin-select-shell-stat">
                              <select value={stat.key} onChange={(event) => updateDraftStat(setDraft, index, 'key', event.target.value)}>
                                {Object.entries(STAT_DEFINITIONS).map(([key, definition]) => (
                                  <option key={key} value={key}>{definition.label}</option>
                                ))}
                              </select>
                            </div>
                            <input type="number" value={stat.value} onChange={(event) => updateDraftStat(setDraft, index, 'value', event.target.value)} style={{ color: statColor }} />
                            <input type="text" placeholder="Scaling note (optional)" value={stat.scaling?.note || ''} onChange={(event) => updateDraftStat(setDraft, index, 'note', event.target.value)} />
                          </div>
                          <div className="admin-stat-actions">
                            <span className="admin-stat-chip">{statDefinition?.label || 'Stat'}</span>
                            <button type="button" className="scrap-mini" onClick={() => removeDraftStat(setDraft, index)}>Remove</button>
                          </div>
                        </div>
                      )
                    })}
                    {draft.stats.length === 0 && <p className="text-sm text-dark-400">No numeric stats added yet.</p>}
                  </div>
                </div>

                <div className="panel-frame-soft p-5 space-y-4">
                  <div className="accent-hand text-xl text-dark-100">Extra effects and wiki refs</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Extra effects (one per line)" multiline>
                      <textarea rows={5} value={draft.extraEffectsText} onChange={(event) => setDraft((current) => ({ ...current, extraEffectsText: event.target.value }))} />
                    </FormField>
                    <div className="space-y-4">
                      <FormField label="Wiki title">
                        <input type="text" value={draft.sourceMeta.wikiTitle} onChange={(event) => setDraft((current) => ({ ...current, sourceMeta: { ...current.sourceMeta, wikiTitle: event.target.value } }))} />
                      </FormField>
                      <FormField label="Wiki URL">
                        <input type="text" value={draft.sourceMeta.wikiUrl} onChange={(event) => setDraft((current) => ({ ...current, sourceMeta: { ...current.sourceMeta, wikiUrl: event.target.value } }))} />
                      </FormField>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="scrap-action"
                    disabled={isSaving}
                    onClick={async () => {
                      const nextRecord = toRecord(draft)
                      if (!nextRecord.name) {
                        pushToast('Name is required before saving.', 'error')
                        return
                      }

                      if (!nextRecord.id) {
                        nextRecord.id = slugify(nextRecord.name)
                      }

                      const existingIndex = accessoryRecords.findIndex((record) => record.id === selectedId || record.id === nextRecord.id)
                      const nextAccessoryRecords = existingIndex === -1
                        ? [...accessoryRecords, nextRecord]
                        : accessoryRecords.map((record, index) => (index === existingIndex ? nextRecord : record))

                      const savedContent = await saveContent({
                        nextAccessoryRecords,
                        message: `Saved ${nextRecord.name || 'accessory'}.`,
                      })
                      if (!savedContent) return

                      setDraft(createDraft(nextRecord))
                      setSelectedId(nextRecord.id)
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save accessory'}
                  </button>
                  <button
                    type="button"
                    className="scrap-mini"
                    onClick={() => {
                      const selectedRecord = accessoryRecords.find((record) => record.id === selectedId)
                      setDraft(createDraft(selectedRecord))
                      setImageCrop(null)
                    }}
                  >
                    Reset draft
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  )
}

function AdminShell({ title, children, toast }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {toast ? <div className={`admin-toast ${toast.type === 'error' ? 'admin-toast-error' : ''}`}>{toast.message}</div> : null}
      <section className="animate-slide-up">
        <div className="scrap-title">{title}</div>
      </section>
      {children}
    </div>
  )
}

function FormField({ label, children, multiline = false, className = '', select = false }) {
  return (
    <label className={`field-shell ${select ? 'select-shell' : ''} ${className}`.trim()}>
      <span className="field-label">{label}</span>
      {multiline ? children : children}
    </label>
  )
}

function getRecordStatValue(record, statKey) {
  return record.stats?.find((stat) => stat.key === statKey)?.value || 0
}

async function prepareAccessoryRecordsForSave(records) {
  const nextRecords = []

  for (const record of records) {
    if (isDataUrlImage(record.image)) {
      const upload = await uploadAdminImage({
        dataUrl: record.image,
        fileName: buildAccessoryImageName(record),
      })

      nextRecords.push({
        ...record,
        image: upload.publicUrl,
      })
      continue
    }

    nextRecords.push(record)
  }

  return nextRecords
}

function isDataUrlImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function buildAccessoryImageName(record) {
  return record.id || record.name || 'accessory-image'
}

function createBlankAccessory() {
  return {
    id: '',
    name: '',
    slot: SLOTS[0],
    rarity: RARITIES[0],
    availability: AVAILABILITY[0],
    caption: '',
    description: '',
    image: '',
    requirements: { tradeLevel: '' },
    source: {
      summary: '',
      by: '',
      location: '',
      dropChance: '',
      detail: '',
    },
    sourceMeta: {
      wikiTitle: '',
      wikiUrl: '',
    },
    extraEffects: [],
    stats: [],
  }
}

function createDraft(record) {
  const blank = createBlankAccessory()
  const base = record ? structuredClone(record) : blank

  return {
    ...blank,
    ...base,
    id: base.id || '',
    name: base.name || '',
    slot: base.slot || blank.slot,
    rarity: base.rarity || blank.rarity,
    availability: base.availability || blank.availability,
    caption: base.caption || '',
    description: base.description || '',
    image: base.image || '',
    requirements: {
      tradeLevel: base.requirements?.tradeLevel ?? '',
    },
    source: {
      summary: base.source?.summary || '',
      by: base.source?.by || '',
      location: base.source?.location || '',
      dropChance: base.source?.dropChance || '',
      detail: base.source?.detail || '',
    },
    sourceMeta: {
      wikiTitle: base.sourceMeta?.wikiTitle || '',
      wikiUrl: base.sourceMeta?.wikiUrl || '',
    },
    stats: Array.isArray(base.stats)
      ? base.stats.map((stat) => ({
          key: stat.key,
          value: stat.value,
          scaling: { note: stat.scaling?.note || '' },
        }))
      : [],
    extraEffectsText: Array.isArray(base.extraEffects) ? base.extraEffects.join('\n') : '',
  }
}

function toRecord(draft) {
  return {
    id: draft.id.trim(),
    name: draft.name.trim(),
    slot: draft.slot,
    rarity: draft.rarity,
    availability: draft.availability,
    caption: draft.caption.trim(),
    description: draft.description.trim(),
    image: draft.image || '',
    requirements: {
      tradeLevel: normalizeNumber(draft.requirements.tradeLevel),
    },
    source: {
      summary: draft.source.summary.trim(),
      by: draft.source.by.trim(),
      location: draft.source.location.trim(),
      dropChance: draft.source.dropChance.trim(),
      detail: draft.source.detail.trim(),
    },
    sourceMeta: {
      wikiTitle: draft.sourceMeta.wikiTitle.trim(),
      wikiUrl: draft.sourceMeta.wikiUrl.trim(),
    },
    extraEffects: draft.extraEffectsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
    stats: draft.stats
      .map((stat) => ({
        key: stat.key,
        value: normalizeNumber(stat.value) ?? 0,
        scaling: stat.scaling?.note?.trim() ? { note: stat.scaling.note.trim() } : undefined,
      }))
      .filter((stat) => Boolean(stat.key)),
  }
}

function updateDraftStat(setDraft, index, field, value) {
  setDraft((current) => {
    const nextStats = [...current.stats]
    const nextStat = { ...nextStats[index], scaling: { ...nextStats[index].scaling } }

    if (field === 'key') nextStat.key = value
    if (field === 'value') nextStat.value = value
    if (field === 'note') nextStat.scaling.note = value

    nextStats[index] = nextStat
    return { ...current, stats: nextStats }
  })
}

function removeDraftStat(setDraft, index) {
  setDraft((current) => ({
    ...current,
    stats: current.stats.filter((_, statIndex) => statIndex !== index),
  }))
}

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function exportContent(content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'glow-content-export.json'
  link.click()
  URL.revokeObjectURL(url)
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getBalancedCropOffset(focus, maxOffset, dominantOverflow, frameSize) {
  const clampedFocus = clamp(focus, 0, 100)

  if (maxOffset <= 0 || dominantOverflow <= 0) {
    if (focus < 0) return (focus / 100) * frameSize
    if (focus > 100) return ((focus - 100) / 100) * frameSize
    return 0
  }

  const centeredFocus = clampedFocus / 100 - 0.5
  const sensitivity = dominantOverflow / maxOffset
  const normalizedFocus = clamp(0.5 + centeredFocus * sensitivity, 0, 1)
  let offset = normalizedFocus * maxOffset

  if (focus < 0) {
    offset += (focus / 100) * frameSize
  }

  if (focus > 100) {
    offset += ((focus - 100) / 100) * frameSize
  }

  return offset
}

function getCropMetrics({ width, height, zoom, focusX, focusY }, frameSize) {
  const baseScale = Math.max(frameSize / width, frameSize / height)
  const scale = baseScale * zoom
  const drawWidth = width * scale
  const drawHeight = height * scale
  const maxOffsetX = Math.max(0, drawWidth - frameSize)
  const maxOffsetY = Math.max(0, drawHeight - frameSize)
  const dominantOverflow = Math.max(maxOffsetX, maxOffsetY)

  return {
    drawWidth,
    drawHeight,
    offsetX: getBalancedCropOffset(focusX, maxOffsetX, dominantOverflow, frameSize),
    offsetY: getBalancedCropOffset(focusY, maxOffsetY, dominantOverflow, frameSize),
  }
}

function getCropPreviewStyle(imageCrop) {
  if (!imageCrop?.width || !imageCrop?.height) return undefined

  const { drawWidth, drawHeight, offsetX, offsetY } = getCropMetrics(imageCrop, 164)

  return {
    width: `${drawWidth}px`,
    height: `${drawHeight}px`,
    transform: `translate3d(${-offsetX}px, ${-offsetY}px, 0)`,
  }
}

async function cropImageSquare({ src, zoom, focusX, focusY }) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  const size = 256
  const context = canvas.getContext('2d')

  canvas.width = size
  canvas.height = size

  const { drawWidth, drawHeight, offsetX, offsetY } = getCropMetrics({
    width: image.width,
    height: image.height,
    zoom,
    focusX,
    focusY,
  }, size)

  context.clearRect(0, 0, size, size)
  context.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight)

  return canvas.toDataURL('image/png')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

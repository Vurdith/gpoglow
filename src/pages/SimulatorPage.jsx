import { useMemo, useState } from 'react'
import AccessoryCard from '../components/AccessoryCard'
import SlotIcon from '../components/SlotIcon'
import {
  AVAILABILITY,
  RARITIES,
  SLOTS,
  STAT_LABELS,
  STAT_FORMATS,
  calculateTotalStats,
  getRarityClass,
  getStatColor,
} from '../data/accessories'
import StatsSummary from '../components/StatsSummary'
import { useSiteContent } from '../context/useSiteContent'

export default function SimulatorPage() {
  const { accessories, siteConfig } = useSiteContent()
  const [equipped, setEquipped] = useState({})
  const [activeSlot, setActiveSlot] = useState(null)
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [availabilityFilter, setAvailabilityFilter] = useState('All')

  const totalStats = useMemo(() => calculateTotalStats(equipped), [equipped])
  const equippedCount = Object.values(equipped).filter(Boolean).length
  const filledPercent = Math.round((equippedCount / SLOTS.length) * 100)

  const availableForSlot = useMemo(() => {
    if (!activeSlot) return []

    return accessories
      .filter((accessory) => {
        if (accessory.slot !== activeSlot) return false
        if (search && !accessory.name.toLowerCase().includes(search.toLowerCase())) return false
        if (rarityFilter !== 'All' && accessory.rarity !== rarityFilter) return false
        if (availabilityFilter !== 'All' && accessory.availability !== availabilityFilter) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [accessories, activeSlot, search, rarityFilter, availabilityFilter])

  const dominantBonus = useMemo(() => {
    const entries = Object.entries(totalStats)
    if (entries.length === 0) return 'No numeric bonuses yet'

    const [stat, value] = entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
    return `${STAT_LABELS[stat]} ${STAT_FORMATS[stat](Math.round(value * 100) / 100)}`
  }, [totalStats])

  function resetSlotBrowserFilters() {
    setSearch('')
    setRarityFilter('All')
    setAvailabilityFilter('All')
  }

  function equipAccessory(accessory) {
    setEquipped((previous) => ({ ...previous, [accessory.slot]: accessory }))
    setActiveSlot(null)
    resetSlotBrowserFilters()
  }

  function unequipSlot(slot) {
    setEquipped((previous) => {
      const next = { ...previous }
      delete next[slot]
      return next
    })
  }

  function clearAll() {
    setEquipped({})
    setActiveSlot(null)
    resetSlotBrowserFilters()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <section className="animate-slide-up">
        <div className="scrap-title">Simulator</div>

        <div className="panel-frame mt-5 p-6 sm:p-7">
          <div className="wiki-copy max-w-4xl space-y-4 text-dark-200">
            <p>{siteConfig.simulatorIntroPrimary}</p>
            <p>{siteConfig.simulatorIntroSecondary}</p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="stat-ticket">
              <div className="ticket-label">Slots filled</div>
              <div className="ticket-value">{equippedCount}/{SLOTS.length}</div>
            </div>
            <div className="stat-ticket">
              <div className="ticket-label">Top bonus</div>
              <div className="ticket-value text-xl sm:text-2xl">{dominantBonus}</div>
            </div>
            <div className="stat-ticket">
              <div className="ticket-label">Completion</div>
              <div className="ticket-value">{filledPercent}%</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-6">
        <div className="panel-frame p-5 sm:p-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div>
              <div className="accent-hand text-xl text-dark-100">Slot board</div>
              <p className="mt-2 text-sm text-dark-300">Open a slot, inspect the pool, and swap until the totals look right.</p>
            </div>
            {equippedCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="scrap-action"
              >
                Clear loadout
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SLOTS.map((slot) => {
              const accessory = equipped[slot]
              const isActive = activeSlot === slot

              return (
                <div
                  key={slot}
                  className={`slot-panel p-5 cursor-pointer ${isActive ? 'slot-panel-active' : accessory ? 'slot-panel-filled' : ''}`}
                  onClick={() => {
                    setActiveSlot(isActive ? null : slot)
                    resetSlotBrowserFilters()
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="slot-emblem">
                      <SlotIcon slot={slot} size={24} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="ticket-label mb-2">{slot}</div>
                      {accessory ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-lg font-semibold text-dark-100 truncate">{accessory.name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <span className={`font-semibold uppercase tracking-[0.22em] ${getRarityClass(accessory.rarity)}`}>
                                  {accessory.rarity}
                                </span>
                                <span className="text-dark-500">•</span>
                                <span className="text-dark-300">{accessory.availability}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                unequipSlot(slot)
                              }}
                              className="scrap-mini"
                            >
                              Remove
                            </button>
                          </div>

                          {Object.keys(accessory.stats).length > 0 ? (
                            <div className="mt-4 space-y-2 text-sm">
                              {Object.entries(accessory.stats).map(([stat, value]) => {
                                const statColor = getStatColor(stat)

                                return (
                                  <div key={stat} className="flex items-center justify-between gap-3 text-sm">
                                    <span style={{ color: statColor }}>{STAT_LABELS[stat]}</span>
                                    <span className="font-semibold" style={{ color: statColor }}>{STAT_FORMATS[stat](value)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="mt-4 text-sm leading-6 text-dark-300">
                              {accessory.description || 'This accessory has non-numeric effects.'}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-lg font-semibold text-dark-100">Select a piece</div>
                          <p className="mt-2 text-sm leading-6 text-dark-300">
                            Browse valid {slot.toLowerCase()} accessories and compare them before equipping one.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="animate-slide-up" style={{ animationDelay: '0.12s' }}>
          <div className="panel-frame p-5 sm:p-6 sticky top-24">
            <div className="accent-hand text-xl text-dark-100">Total output</div>
            <p className="mt-2 text-sm text-dark-300">All numeric bonuses stack here automatically.</p>

            <div className="summary-row mt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-dark-300">Completion</span>
                <span className="font-semibold text-dark-100">{filledPercent}%</span>
              </div>
              <div className="stat-bar mt-3">
                <div className="stat-bar-fill" style={{ width: `${filledPercent}%` }}></div>
              </div>
            </div>

            <div className="mt-5">
              <StatsSummary stats={totalStats} />
            </div>

            {equippedCount > 0 && (
              <div className="mt-6 pt-6 border-t border-white/8">
                <div className="ticket-label mb-4">Equipped</div>
                <div className="space-y-3">
                  {Object.entries(equipped).map(([slot, accessory]) => (
                    <div key={slot} className="summary-row">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-dark-300">{slot}</span>
                        <span className={`text-sm font-semibold truncate ${getRarityClass(accessory.rarity)}`}>
                          {accessory.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      {activeSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/78 p-4 animate-fade-in">
          <div className="modal-shell w-full max-w-5xl max-h-[86vh] flex flex-col">
            <div className="p-5 sm:p-6 border-b border-white/8 flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="accent-hand text-2xl text-dark-100">{activeSlot}</div>
                <p className="mt-2 text-sm text-dark-300">{availableForSlot.length} accessories available for this slot.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveSlot(null)
                  resetSlotBrowserFilters()
                }}
                className="scrap-mini"
              >
                Close
              </button>
            </div>

            <div className="p-5 sm:p-6 border-b border-white/8 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="field-shell">
                  <span className="field-label">Search this slot</span>
                  <input
                    type="text"
                    placeholder={`Type a ${activeSlot.toLowerCase()} accessory name...`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    autoFocus
                  />
                </label>

                <label className="field-shell select-shell">
                  <span className="field-label">Availability</span>
                  <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
                    <option value="All">All availability</option>
                    {AVAILABILITY.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell select-shell">
                  <span className="field-label">Rarity</span>
                  <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
                    <option value="All">All rarities</option>
                    {RARITIES.map((rarity) => (
                      <option key={rarity} value={rarity}>
                        {rarity}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {availableForSlot.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {availableForSlot.map((accessory) => (
                    <AccessoryCard
                      key={accessory.id}
                      accessory={accessory}
                      onAction={equipAccessory}
                      actionLabel="Equip"
                    />
                  ))}
                </div>
              ) : (
                <div className="panel-frame p-10 text-center">
                  <div className="accent-hand text-2xl text-dark-100">Nothing matched this slot search.</div>
                  <p className="mt-2 text-sm text-dark-300">Try a shorter name or clear the query to see the full slot pool.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

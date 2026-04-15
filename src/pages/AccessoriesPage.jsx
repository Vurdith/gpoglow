import { useMemo, useState } from 'react'
import { AVAILABILITY, RARITIES, SLOTS, STAT_LABELS } from '../data/accessories'
import AccessoryCard from '../components/AccessoryCard'
import { useSiteContent } from '../context/useSiteContent'

const sortLabels = {
  name: 'Name',
  rarity: 'Rarity',
  slot: 'Slot',
  availability: 'Availability',
  hp: 'HP',
  hpRegen: 'HP Regen',
  stamina: 'Stamina',
  staminaRegen: 'Stamina Regen',
  swordDmg: 'Sword DMG',
  strengthDmg: 'Strength DMG',
  reducedDmg: 'Reduced DMG',
  burnReduction: 'Burn Reduction',
  freezeReduction: 'Freeze Reduction',
}

export default function AccessoriesPage() {
  const { accessories, siteConfig } = useSiteContent()
  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState('All')
  const [rarityFilter, setRarityFilter] = useState('All')
  const [availabilityFilter, setAvailabilityFilter] = useState('All')
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    const direction = sortDirection === 'asc' ? 1 : -1

    const result = accessories.filter((accessory) => {
      if (normalizedSearch && !accessory.name.toLowerCase().includes(normalizedSearch)) return false
      if (slotFilter !== 'All' && accessory.slot !== slotFilter) return false
      if (rarityFilter !== 'All' && accessory.rarity !== rarityFilter) return false
      if (availabilityFilter !== 'All' && accessory.availability !== availabilityFilter) return false
      return true
    })

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * direction
      if (sortBy === 'rarity') return (RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)) * direction
      if (sortBy === 'slot') return a.slot.localeCompare(b.slot) * direction
      if (sortBy === 'availability') return a.availability.localeCompare(b.availability) * direction
      if (STAT_LABELS[sortBy]) return ((a.stats[sortBy] || 0) - (b.stats[sortBy] || 0)) * direction
      return 0
    })

    return result
  }, [accessories, search, slotFilter, rarityFilter, availabilityFilter, sortBy, sortDirection])

  const resultSections = useMemo(() => {
    if (availabilityFilter === 'Obtainable') {
      return [{ key: 'obtainable', title: 'Currently obtainable', items: filtered }]
    }

    if (availabilityFilter === 'Unobtainable') {
      return [{ key: 'unobtainable', title: 'Unobtainable', items: filtered }]
    }

    return [
      {
        key: 'obtainable',
        title: 'Currently obtainable',
        items: filtered.filter((accessory) => accessory.availability === 'Obtainable'),
      },
      {
        key: 'unobtainable',
        title: 'Unobtainable',
        items: filtered.filter((accessory) => accessory.availability === 'Unobtainable'),
      },
    ].filter((section) => section.items.length > 0)
  }, [availabilityFilter, filtered])

  const metrics = [
    ['Total', accessories.length],
    ['Current', accessories.filter((item) => item.availability === 'Obtainable').length],
    ['Unobtainable', accessories.filter((item) => item.availability === 'Unobtainable').length],
    ['Slots', SLOTS.length],
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <section className="animate-slide-up">
        <div className="scrap-title">Accessories</div>

        <div className="panel-frame mt-5 p-6 sm:p-7 space-y-6">
          <div className="wiki-copy max-w-4xl text-dark-200">
            {siteConfig.accessoriesIntro}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map(([label, value]) => (
              <div key={label} className="stat-ticket">
                <div className="ticket-label">{label}</div>
                <div className="ticket-value">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-frame p-5 sm:p-6 animate-slide-up" style={{ animationDelay: '0.06s' }}>
        <div className="flex flex-col gap-6">
          <div>
            <div className="accent-hand text-xl text-dark-100">Slot tabs</div>
            <div className="scrap-tabs mt-4">
              <button type="button" className={`scrap-tab ${slotFilter === 'All' ? 'scrap-tab-active' : ''}`} onClick={() => setSlotFilter('All')}>
                All
              </button>
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`scrap-tab ${slotFilter === slot ? 'scrap-tab-active' : ''}`}
                  onClick={() => setSlotFilter(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <FilterField label="Search">
              <input
                type="text"
                placeholder="Roger's Hat, Kraken Armor..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FilterField>

            <FilterField label="Availability" select>
              <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
                <option value="All">All</option>
                {AVAILABILITY.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Rarity" select>
              <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
                <option value="All">All Rarities</option>
                {RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Sort stat / field" select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Direction" select>
              <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
                <option value="asc">Ascending / Lowest first</option>
                <option value="desc">Descending / Highest first</option>
              </select>
            </FilterField>
          </div>
        </div>
      </section>

      <section className="animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <div className="panel-frame p-5 sm:p-6 mb-5">
          <div className="accent-hand text-xl text-dark-100">Archive results</div>
          <p className="mt-2 text-sm text-dark-300 leading-7">
            {filtered.length} results • {slotFilter === 'All' ? 'All slots' : slotFilter} • {availabilityFilter === 'All' ? 'Split by availability' : availabilityFilter} • {rarityFilter === 'All' ? 'All rarities' : rarityFilter} • {sortDirection === 'desc' ? 'Highest first' : 'Lowest first'} by {sortLabels[sortBy]}
          </p>
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-8">
            {resultSections.map((section) => (
              <div key={section.key} className="space-y-4">
                <div className="panel-frame p-4 sm:p-5">
                  <div className="accent-hand text-xl text-dark-100">{section.title}</div>
                  <p className="mt-2 text-sm text-dark-300">{section.items.length} accessories in this section.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {section.items.map((accessory, index) => (
                    <div key={accessory.id} className="h-full animate-fade-in" style={{ animationDelay: `${index * 0.02}s` }}>
                      <AccessoryCard accessory={accessory} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-frame p-10 sm:p-14 text-center">
            <div className="accent-hand text-2xl text-dark-100">No accessories matched that search.</div>
            <p className="mt-3 max-w-xl mx-auto text-dark-300 leading-7">
              Try a broader name, another slot tab, or a wider availability filter.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function FilterField({ label, children, select = false }) {
  return (
    <label className={`field-shell ${select ? 'select-shell' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

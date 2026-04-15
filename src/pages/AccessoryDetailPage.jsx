import { Link, useParams } from 'react-router-dom'
import SlotIcon from '../components/SlotIcon'
import { getRarityClass, getRarityColor, getStatColor, STAT_FORMATS, STAT_LABELS } from '../data/accessories'
import { useSiteContent } from '../context/useSiteContent'

export default function AccessoryDetailPage() {
  const { id } = useParams()
  const { accessories } = useSiteContent()
  const accessory = accessories.find((item) => item.id === id)

  if (!accessory) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        <Link to="/" className="scrap-mini inline-flex">Back to accessories</Link>
        <div className="panel-frame p-8">
          <div className="accent-hand text-2xl text-dark-100">Accessory not found</div>
          <p className="mt-3 text-dark-300">This item does not exist in the current local dataset.</p>
        </div>
      </div>
    )
  }

  const rarityColor = getRarityColor(accessory.rarity)
  const stats = accessory.rawStats || []
  const availabilityLabel = accessory.availability
  const overview = buildOverview(accessory) || 'No overview available yet.'
  const metadataCards = [
    { label: 'Availability', value: availabilityLabel },
    { label: 'Trade level', value: accessory.tradeLevel ? `${accessory.tradeLevel}+` : 'Unknown / not listed' },
    { label: 'Dropped by', value: accessory.source?.by || 'Unknown / not listed' },
    { label: 'Drop chance', value: accessory.source?.dropChance || 'Unknown / not listed' },
    { label: 'Location', value: accessory.source?.location || 'Unknown / not listed' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link to="/" className="scrap-mini inline-flex">Back to accessories</Link>

      <section className="animate-slide-up">
        <div className="scrap-title">{accessory.name}</div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
        <div className="panel-frame p-6 sm:p-7 animate-slide-up" style={{ animationDelay: '0.04s' }}>
          <div className="flex items-start gap-4">
            <div
              className="w-24 h-24 rounded-[1.75rem] border flex items-center justify-center shrink-0 text-3xl"
              style={{
                borderColor: rarityColor,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                boxShadow: `inset 0 0 32px ${rarityColor}`,
              }}
            >
              {accessory.image ? (
                <img src={accessory.image} alt={accessory.name} className="w-full h-full object-cover rounded-[1.75rem]" />
              ) : (
                <SlotIcon slot={accessory.slot} size={44} className="opacity-80" />
              )}
            </div>

            <div className="min-w-0">
              <div className="micro-label mb-2">{accessory.slot}</div>
              <div className={`text-sm font-semibold uppercase tracking-[0.24em] ${getRarityClass(accessory.rarity)}`}>
                {accessory.rarity}
              </div>
              <div className="mt-2 text-sm text-dark-300">{availabilityLabel}</div>
            </div>
          </div>

          <p className="card-copy mt-6 text-dark-200">{overview}</p>

          <div className="detail-grid mt-6 pt-6 border-t border-white/8 text-sm">
            {metadataCards.map((item, index) => (
              <DetailRow
                key={item.label}
                label={item.label}
                value={item.value}
                wide={metadataCards.length % 2 === 1 && index === metadataCards.length - 1}
              />
            ))}
          </div>

          {accessory.sourceText ? (
            <div className="detail-note mt-4">
              <div className="detail-note-label">Source</div>
              <p className="detail-note-copy">{accessory.sourceText}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
          <div className="panel-frame p-6 sm:p-7">
            <div className="accent-hand text-xl text-dark-100">Stats</div>
            {stats.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stats.map((stat) => {
                  const statColor = getStatColor(stat.key)

                  return (
                    <div key={stat.key} className="card-stat-row">
                      <div className="text-[0.68rem] uppercase tracking-[0.18em] mb-1" style={{ color: statColor }}>
                        {STAT_LABELS[stat.key]}
                      </div>
                      <div className="text-lg font-semibold" style={{ color: statColor }}>
                        {STAT_FORMATS[stat.key](stat.value)}
                      </div>
                      {stat.scaling?.note ? (
                        <p className="mt-2 text-xs text-dark-400 leading-5">{stat.scaling.note}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="summary-row mt-5 text-dark-300">This accessory does not expose direct numeric stats in the local dataset.</div>
            )}
          </div>

          {accessory.extraEffects?.length > 0 && (
            <div className="panel-frame p-6 sm:p-7">
              <div className="accent-hand text-xl text-dark-100">Extra effects</div>
              <div className="mt-5 space-y-3">
                {accessory.extraEffects.map((effect) => (
                  <div key={effect} className="summary-row text-sm text-dark-200 leading-6">
                    {effect}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel-frame p-6 sm:p-7">
            <div className="accent-hand text-xl text-dark-100">Source reference</div>
            <div className="mt-5 space-y-3 text-sm">
              <DetailRow label="Wiki title" value={accessory.sourceMeta?.wikiTitle || 'Unknown'} />
              <div className="card-footer-row">
                <span className="text-dark-400 shrink-0">Wiki link</span>
                <a
                  href={accessory.sourceMeta?.wikiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-right text-gpo-blue hover:text-dark-100 transition-colors"
                >
                  Open source page
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

function DetailRow({ label, value, wide = false }) {
  return (
    <div className={`detail-card ${wide ? 'detail-card-wide' : ''}`}>
      <span className="detail-card-label">{label}</span>
      <span className="detail-card-value">{value}</span>
    </div>
  )
}

function buildOverview(accessory) {
  const parts = [accessory.caption, accessory.description]
    .map((value) => normalizeText(value))
    .filter(Boolean)

  const merged = []

  for (const part of parts) {
    if (!merged.some((existing) => isSameMeaning(existing, part))) {
      merged.push(part)
    }
  }

  return merged.join(' ')
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function isSameMeaning(a, b) {
  const left = a.toLowerCase()
  const right = b.toLowerCase()

  return left === right || left.includes(right) || right.includes(left)
}

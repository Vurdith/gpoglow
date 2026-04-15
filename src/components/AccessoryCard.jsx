import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import SlotIcon from './SlotIcon'
import { getRarityClass, getRarityColor, getStatColor, STAT_FORMATS, STAT_LABELS } from '../data/accessories'

const CARD_STAT_LIMIT = 4
const TOOLTIP_WIDTH = 280

export default function AccessoryCard({ accessory, actionLabel = 'Open page', onAction }) {
  const navigate = useNavigate()
  const cardRef = useRef(null)
  const [hoverTip, setHoverTip] = useState({ open: false, x: 24, y: 24 })
  const [isInView, setIsInView] = useState(true)
  const statEntries = Object.entries(accessory.stats)
  const visibleStats = statEntries.slice(0, CARD_STAT_LIMIT)
  const extraStats = statEntries.slice(CARD_STAT_LIMIT)
  const emptyStatCount = Math.max(0, CARD_STAT_LIMIT - visibleStats.length)
  const rarityColor = getRarityColor(accessory.rarity)
  const rarityGradient = getRarityAccentGradient(accessory.rarity)
  const overview = buildOverview(accessory)
  const obtainText = [accessory.source?.by, accessory.source?.location, accessory.source?.dropChance].filter(Boolean).join(' • ') || accessory.sourceText || 'Unknown source'

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || !cardRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { rootMargin: '180px 0px' },
    )

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  const handleAction = () => {
    if (typeof onAction === 'function') {
      onAction(accessory)
      return
    }

    navigate(`/accessories/${accessory.id}`)
  }

  const hideHoverTip = () => {
    setHoverTip((current) => (current.open ? { ...current, open: false } : current))
  }

  const updateHoverTip = (event) => {
    if (shouldIgnoreHoverTarget(event.target)) {
      hideHoverTip()
      return
    }

    if (typeof window === 'undefined') return

    const tooltipHalfWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - 32) / 2
    const nextX = Math.min(
      Math.max(18 + tooltipHalfWidth, event.clientX),
      window.innerWidth - tooltipHalfWidth - 18,
    )

    setHoverTip({ open: true, x: nextX, y: Math.max(24, event.clientY) })
  }

  return (
    <>
      <article
        ref={cardRef}
        className={`catalog-card group ${isInView ? 'card-rarity-animated' : ''}`}
        style={{ '--card-rarity-color': rarityColor, '--card-rarity-gradient': rarityGradient }}
        onMouseEnter={updateHoverTip}
        onMouseMove={updateHoverTip}
        onMouseLeave={hideHoverTip}
      >
        <div className="catalog-card-rail"></div>

        <div className="p-5 pt-10 flex h-full flex-col relative z-10 gap-4">
          <div className="flex items-start gap-3 min-w-0 card-header-block">
            <div className="card-icon-shell w-[4.5rem] h-[4.5rem] rounded-[1.4rem] border flex items-center justify-center shrink-0 text-2xl">
              {accessory.image ? (
                <img src={accessory.image} alt={accessory.name} className="relative z-10 w-full h-full object-cover rounded-[1.4rem]" />
              ) : (
                <SlotIcon slot={accessory.slot} size={34} className="relative z-10 opacity-80" />
              )}
            </div>

            <div className="min-w-0 flex-1 card-header-copy">
              <p className="micro-label mb-1">{accessory.slot}</p>
              <div className="card-name-block">
                <h3 className="card-title text-[1.05rem] font-semibold text-dark-100" title={accessory.name}>
                  {accessory.name}
                </h3>
                <div className="mt-2 text-xs">
                  <span className={`font-semibold uppercase tracking-[0.22em] ${getRarityClass(accessory.rarity)}`}>
                    {accessory.rarity}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {statEntries.length > 0 ? (
            <div data-tip-ignore="true">
              <div className="card-stat-grid">
                {visibleStats.map(([stat, value]) => {
                  const statColor = getStatColor(stat)

                  return (
                    <div key={stat} className="card-stat-row">
                      <div className="card-stat-label" style={{ color: statColor }}>
                        {STAT_LABELS[stat]}
                      </div>
                      <div className="card-stat-value" style={{ color: statColor }}>{STAT_FORMATS[stat](value)}</div>
                    </div>
                  )
                })}

                {Array.from({ length: emptyStatCount }).map((_, index) => (
                  <div key={`empty-${index}`} className="card-stat-row card-stat-row-empty" aria-hidden="true"></div>
                ))}
              </div>

              {extraStats.length > 0 ? (
                <details className="card-stats-dropdown mt-3">
                  <summary className="card-stats-toggle">Show additional stats</summary>
                  <div className="card-extra-stats">
                    {extraStats.map(([stat, value]) => {
                      const statColor = getStatColor(stat)

                      return (
                        <div key={stat} className="card-extra-stat">
                          <span className="card-extra-stat-label" style={{ color: statColor }}>{STAT_LABELS[stat]}</span>
                          <span className="card-extra-stat-value" style={{ color: statColor }}>{STAT_FORMATS[stat](value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <div className="summary-row card-effect-row">
              <div className="card-copy text-dark-300">Unique effect item</div>
            </div>
          )}

          <button type="button" className="scrap-action card-action-button mt-auto w-full" data-tip-ignore="true" onClick={handleAction}>
            {actionLabel}
          </button>
        </div>
      </article>

      {hoverTip.open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="card-hover-tip card-hover-tip-open"
              style={{ left: `${hoverTip.x}px`, top: `${hoverTip.y}px` }}
            >
              <div className="card-hover-tip-label">Overview</div>
              <p className="card-hover-tip-copy line-clamp-4">{overview || 'No description listed yet.'}</p>
              <div className="card-hover-tip-label mt-3">Obtained from</div>
              <p className="card-hover-tip-copy line-clamp-3">{obtainText}</p>
            </div>,
            document.body,
          )
        : null}
    </>
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

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function isSameMeaning(a, b) {
  const left = a.toLowerCase()
  const right = b.toLowerCase()

  return left === right || left.includes(right) || right.includes(left)
}

function shouldIgnoreHoverTarget(target) {
  return target instanceof Element && Boolean(target.closest('[data-tip-ignore="true"]'))
}

function getRarityAccentGradient(rarity) {
  const map = {
    Common: 'linear-gradient(90deg, #a8afb9, #c6ccd4, #a8afb9)',
    Uncommon: 'linear-gradient(90deg, #4fd77a, #8af0ab, #4fd77a)',
    Rare: 'linear-gradient(90deg, #6fb0ff, #a8d0ff, #6fb0ff)',
    Epic: 'linear-gradient(90deg, #b58cff, #dcc4ff, #b58cff)',
    Legendary: 'linear-gradient(90deg, #ff5f6d 0%, #ffc371 18%, #fff275 34%, #6ee7b7 52%, #60a5fa 70%, #a78bfa 86%, #ff7ac6 100%)',
    Mythical: 'linear-gradient(90deg, #c084fc 0%, #f472b6 35%, #7dd3fc 70%, #f5d0fe 100%)',
    Collectable: 'linear-gradient(90deg, #ffffff 0%, #cbcbcb 24%, #5e5e5e 42%, #f5f5f5 62%, #1a1a1a 78%, #f3f4f6 100%)',
  }

  return map[rarity] || `linear-gradient(90deg, ${getRarityColor(rarity)}, ${getRarityColor(rarity)})`
}

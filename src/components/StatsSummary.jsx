import { getStatColor, STAT_FORMATS, STAT_LABELS } from '../data/accessories'

export default function StatsSummary({ stats }) {
  const entries = Object.entries(stats).filter(([, value]) => value !== 0)
  const maxValue = Math.max(...entries.map(([, value]) => Math.abs(value)), 1)

  if (entries.length === 0) {
    return (
      <div className="panel-frame-soft px-5 py-8 text-center text-dark-400">
        <div className="accent-hand text-xl text-dark-100">No active build</div>
        <p className="mt-4 text-base text-dark-200">No accessories equipped yet.</p>
        <p className="mt-2 text-sm text-dark-400">
          Add a few pieces and the stat ledger will start filling itself in.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(([stat, value]) => {
        const width = Math.max((Math.abs(value) / maxValue) * 100, 18)
        const statColor = getStatColor(stat)

        return (
          <div key={stat} className="summary-row">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: statColor }}>{STAT_LABELS[stat]}</span>
              <span className="text-sm font-semibold" style={{ color: statColor }}>
                {STAT_FORMATS[stat](Math.round(value * 100) / 100)}
              </span>
            </div>
            <div className="stat-bar mt-3">
              <div className="stat-bar-fill" style={{ width: `${width}%`, background: statColor }}></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

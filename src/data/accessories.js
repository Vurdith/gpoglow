import accessoryRecords from './accessories.json'

export const SLOTS = [
  'Head',
  'Face',
  'Forehead',
  'Ear',
  'Neck',
  'All Seeing Eye',
  'Armor',
  'Back',
  'Shoulder',
  'Waist',
  'Misc',
]

export const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Mythical',
  'Collectable',
]

export const AVAILABILITY = ['Obtainable', 'Unobtainable']

export const STAT_DEFINITIONS = {
  hp: {
    label: 'HP',
    unit: 'flat',
    color: 'var(--color-stat-hp)',
    format: (value) => `+${value}`,
  },
  hpRegen: {
    label: 'HP Regen',
    unit: 'regen',
    color: 'var(--color-stat-hp-regen)',
    format: (value) => `+${value}/s`,
  },
  stamina: {
    label: 'Stamina',
    unit: 'flat',
    color: 'var(--color-stat-stamina)',
    format: (value) => `+${value}`,
  },
  staminaRegen: {
    label: 'Stamina Regen',
    unit: 'regen',
    color: 'var(--color-stat-stamina-regen)',
    format: (value) => `+${value}/s`,
  },
  swordDmg: {
    label: 'Sword DMG',
    unit: 'percent',
    color: 'var(--color-stat-sword)',
    format: (value) => `+${value}%`,
  },
  strengthDmg: {
    label: 'Strength DMG',
    unit: 'percent',
    color: 'var(--color-stat-strength)',
    format: (value) => `+${value}%`,
  },
  reducedDmg: {
    label: 'Reduced DMG',
    unit: 'percent',
    color: 'var(--color-stat-reduced)',
    format: (value) => `+${value}%`,
  },
  burnReduction: {
    label: 'Burn Reduction',
    unit: 'percent',
    color: 'var(--color-stat-burn)',
    format: (value) => `+${value}%`,
  },
  freezeReduction: {
    label: 'Freeze Reduction',
    unit: 'percent',
    color: 'var(--color-stat-freeze)',
    format: (value) => `+${value}%`,
  },
}

export const STAT_LABELS = Object.fromEntries(
  Object.entries(STAT_DEFINITIONS).map(([key, definition]) => [key, definition.label]),
)

export const STAT_FORMATS = Object.fromEntries(
  Object.entries(STAT_DEFINITIONS).map(([key, definition]) => [key, definition.format]),
)

export { accessoryRecords }

export const accessories = hydrateAccessories(accessoryRecords)

export function hydrateAccessories(records = []) {
  return records.map(hydrateAccessoryRecord)
}

export function hydrateAccessoryRecord(record) {
  return {
    ...record,
    tradeLevel: record.requirements?.tradeLevel ?? null,
    sourceText: record.source?.summary || '',
    rawStats: record.stats || [],
    stats: statArrayToMap(record.stats),
  }
}

export function statArrayToMap(stats = []) {
  return Object.fromEntries(stats.map((stat) => [stat.key, stat.value]))
}

export function calculateTotalStats(equippedAccessories) {
  const totals = {}

  for (const accessory of Object.values(equippedAccessories)) {
    if (!accessory) continue

    for (const [stat, value] of Object.entries(accessory.stats)) {
      totals[stat] = (totals[stat] || 0) + value
    }
  }

  return totals
}

export function getStatColor(stat) {
  return STAT_DEFINITIONS[stat]?.color || 'var(--color-dark-200)'
}

export function getRarityColor(rarity) {
  const map = {
    Common: 'var(--color-rarity-common)',
    Uncommon: 'var(--color-rarity-uncommon)',
    Rare: 'var(--color-rarity-rare)',
    Epic: 'var(--color-rarity-epic)',
    Legendary: 'var(--color-rarity-legendary)',
    Mythical: 'var(--color-rarity-mythical)',
    Collectable: 'var(--color-rarity-collectable)',
  }

  return map[rarity] || 'var(--color-dark-200)'
}

export function getRarityClass(rarity) {
  const map = {
    Common: 'text-rarity-common',
    Uncommon: 'text-rarity-uncommon',
    Rare: 'text-rarity-rare',
    Epic: 'text-rarity-epic',
    Legendary: 'text-rarity-legendary',
    Mythical: 'text-rarity-mythical',
    Collectable: 'text-rarity-collectable',
  }

  return map[rarity] || 'text-dark-200'
}

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const slotOrder = [
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

const slotMap = Object.fromEntries(slotOrder.map((slot) => [slot, slot]))
const rarityMap = {
  C: 'Common',
  U: 'Uncommon',
  R: 'Rare',
  E: 'Epic',
  L: 'Legendary',
  M: 'Mythical',
  RC: 'Rare',
  LC: 'Legendary',
  CB: 'Collectable',
}

const statMeta = {
  hp: { unit: 'flat' },
  hpRegen: { unit: 'regen' },
  stamina: { unit: 'flat' },
  staminaRegen: { unit: 'regen' },
  swordDmg: { unit: 'percent' },
  strengthDmg: { unit: 'percent' },
  reducedDmg: { unit: 'percent' },
  burnReduction: { unit: 'percent' },
  freezeReduction: { unit: 'percent' },
}

const accessoriesUrl = 'https://grand-piece-online.fandom.com/api.php?action=parse&page=Accessories&prop=wikitext&formatversion=2&format=json'
const aseUrl = 'https://grand-piece-online.fandom.com/api.php?action=parse&page=All_Seeing_Eye&prop=wikitext&formatversion=2&format=json'

const [{ parse: accessoriesParse }, { parse: aseParse }] = await Promise.all([
  fetchJson(accessoriesUrl),
  fetchJson(aseUrl),
])

const asePerks = extractAsePerks(aseParse.wikitext)
const accessories = await parseAccessories(accessoriesParse.wikitext, asePerks)

const outputPath = resolve('src/data/accessories.json')
writeFileSync(outputPath, JSON.stringify(accessories, null, 2) + '\n')

const bySlot = accessories.reduce((map, accessory) => {
  map[accessory.slot] = (map[accessory.slot] || 0) + 1
  return map
}, {})

console.log(`Synced ${accessories.length} accessories -> ${outputPath}`)
console.log(bySlot)

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed: ${url} (${response.status})`)
  }
  return response.json()
}

async function parseAccessories(wikitext, asePerks) {
  const slotRegex = /\|-\|\s*([^=\n]+?)\s*=\n([\s\S]*?)(?=\n\|-\||$)/g
  const parsed = []

  for (const slotMatch of wikitext.matchAll(slotRegex)) {
    const rawSlot = slotMatch[1].trim()
    const slot = slotMap[rawSlot]
    if (!slot) continue

    const slotBlock = slotMatch[2]

    for (const availability of ['Obtainable', 'Unobtainable']) {
      const availabilityRegex = new RegExp(`=== ${availability} ===([\\s\\S]*?)(?=\\n===|$)`, 'g')

      for (const availabilityMatch of slotBlock.matchAll(availabilityRegex)) {
        const section = availabilityMatch[1]
        const rowMatches = [...section.matchAll(/\|-.*?\n([\s\S]*?)(?=\n\|-|\n\|}|$)/g)]

        for (const rowMatch of rowMatches) {
          const row = rowMatch[1]
          const link = extractLink(row)
          if (!link?.name) continue

          const rarityCode = row.match(/\{\{Rarity\|([^}]+)\}\}/)?.[1]?.trim() || 'R'
          const rarity = rarityMap[rarityCode] || 'Rare'
          const afterRarity = row.slice(row.indexOf('{{Rarity|') >= 0 ? row.indexOf('}}', row.indexOf('{{Rarity|')) + 2 : 0)
          const pipeLines = afterRarity
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.startsWith('|') && !line.startsWith('|-') && line !== '|}')

          const buffRaw = pipeLines[0]?.slice(1).trim() || ''
          const sourceRaw = pipeLines[1]?.slice(1).trim() || ''
          const sourceSummary = cleanInline(sourceRaw)
          const parsedStats = parseStats(buffRaw)

          const accessory = {
            id: slugify(`${slot}-${link.name}`),
            name: link.name,
            slot,
            rarity,
            availability,
            description: parsedStats.description || null,
            image: null,
            requirements: {
              tradeLevel: null,
            },
            maxStack: slot === 'All Seeing Eye' ? 3 : 1,
            tags: [],
            source: {
              summary: sourceSummary,
              type: inferSourceType(sourceSummary),
            },
            stats: parsedStats.stats,
            extraEffects: slot === 'All Seeing Eye' ? asePerks : [],
            sourceMeta: {
              wikiTitle: link.wikiTitle,
              wikiUrl: buildWikiUrl(link.wikiTitle),
              syncedAt: new Date().toISOString(),
            },
          }

          parsed.push(accessory)
        }
      }
    }
  }

  const deduped = []
  const seen = new Set()

  for (const accessory of parsed) {
    const key = `${accessory.slot}::${accessory.name}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(accessory)
  }

  for (let index = 0; index < deduped.length; index += 1) {
    await enrichAccessory(deduped[index])

    if ((index + 1) % 20 === 0) {
      console.log(`Enriched ${index + 1}/${deduped.length}`)
    }

    await delay(100)
  }

  return deduped
}

function extractAsePerks(wikitext) {
  const section = wikitext.match(/=== Item Perks ===([\s\S]*?)(?=\n===|$)/)?.[1] || ''

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('*'))
    .map((line) => line.replace(/^\*+\s*/, ''))
    .map(cleanInline)
    .filter(Boolean)
}

function extractLink(row) {
  const match = row.match(/'''\[\[([^|\]]+)(?:\|([^\]]+))?\]\]'''/) || row.match(/'''\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/)
  if (!match) return null

  const wikiTitle = cleanInline(match[1])
  const display = cleanInline(match[2] || match[1])
  return { wikiTitle, name: normalizeName(display) }
}

function parseStats(buffRaw) {
  const clean = cleanText(buffRaw)
  const parts = clean
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const stats = []
  const seen = new Set()
  let description = ''

  for (const part of parts) {
    const value = readNumber(part)

    if (/HP Regen|Health Regen/i.test(part)) {
      pushStat('hpRegen', value, part)
      continue
    }

    if (/Stamina Regen/i.test(part)) {
      pushStat('staminaRegen', value, part)
      continue
    }

    if (/Sword DMG/i.test(part)) {
      pushStat('swordDmg', value, part)
      continue
    }

    if (/Strength DMG/i.test(part)) {
      pushStat('strengthDmg', value, part)
      continue
    }

    if (/Reduced Burn/i.test(part) || /Reduced Burn Damage/i.test(part)) {
      pushStat('burnReduction', value, part)
      continue
    }

    if (/Reduced Freeze/i.test(part)) {
      pushStat('freezeReduction', value, part)
      continue
    }

    if (/reduced damage/i.test(part)) {
      const maxMatch = clean.match(/Max of\s+(\d+(?:[.,]\d+)?)%/i)
      const reducedValue = maxMatch ? toNumber(maxMatch[1]) : value ?? 0
      pushStat('reducedDmg', reducedValue, part, description
        ? { stat: 'level', note: clean, max: reducedValue }
        : { stat: 'level', note: clean, max: reducedValue })
      description = clean
      continue
    }

    if (/Extra Stamina|\bStamina\b/i.test(part) && !/Regen/i.test(part)) {
      pushStat('stamina', value, part)
      continue
    }

    if (/Extra Health|\bHP\b/i.test(part) && !/Regen/i.test(part)) {
      pushStat('hp', value, part)
      continue
    }
  }

  if (!description && /List of Buffs can be seen here/i.test(clean)) {
    description = 'Unique perk item. See the extra effects list for its non-stat bonuses.'
  }

  return { stats, description }

  function pushStat(key, value, text, scaling = null) {
    if (value == null) return
    if (seen.has(key)) return
    seen.add(key)
    stats.push({
      key,
      value,
      unit: statMeta[key].unit,
      text: cleanInline(text),
      scaling,
    })
  }
}

function inferSourceType(source) {
  if (/Dropped by defeating/i.test(source)) return 'boss'
  if (/Purchasable at/i.test(source)) return 'shop'
  if (/Crafted at/i.test(source)) return 'craft'
  if (/Fishing/i.test(source)) return 'fishing'
  if (/quest/i.test(source)) return 'quest'
  if (/Opening|Giftbox|gift/i.test(source)) return 'event'
  if (/Winning/i.test(source)) return 'activity'
  return 'other'
}

function buildWikiUrl(title) {
  return `https://grand-piece-online.fandom.com/wiki/${title.replace(/\s+/g, '_')}`
}

async function enrichAccessory(accessory) {
  try {
    const pageUrl = `https://grand-piece-online.fandom.com/api.php?action=parse&page=${encodeURIComponent(accessory.sourceMeta.wikiTitle)}&prop=wikitext&formatversion=2&format=json`
    const page = await fetchJson(pageUrl)
    const wikitext = page.parse?.wikitext || ''
    const infobox = parseInfobox(wikitext)
    const description = extractDescription(wikitext)

    if (description) {
      accessory.description = description
    }

    const tradeLevel = parseTradeLevel(infobox.trade_level)
    if (tradeLevel != null) {
      accessory.requirements.tradeLevel = tradeLevel
    }

    const caption = cleanInline(infobox.caption1 || '')
    if (caption) {
      accessory.caption = caption
    }

    const dropChance = cleanInline(infobox.drop_chance || '')
    const location = cleanInline(infobox.location || '')
    const droppedBy = cleanInline(infobox.dropped_by || '')
    const obtainment = cleanInline(infobox.obtaiment || infobox.obtainment || '')

    if (dropChance) accessory.source.dropChance = dropChance
    if (location) accessory.source.location = location
    if (droppedBy) accessory.source.by = droppedBy
    if (obtainment) accessory.source.detail = obtainment
  } catch (error) {
    accessory.sourceMeta.enrichError = String(error)
  }
}

function parseInfobox(wikitext) {
  const template = extractAccessoryTemplate(wikitext)
  if (!template) return {}

  const body = template.replace(/^\{\{Accessory/, '').replace(/\}\}$/, '')
  const fields = {}

  for (const field of body.matchAll(/\|\s*([^=|\n]+?)\s*=\s*([\s\S]*?)(?=(?:\|\s*[^=|\n]+?\s*=)|$)/g)) {
    fields[field[1].trim()] = field[2].trim()
  }

  return fields
}

function extractDescription(wikitext) {
  const template = extractAccessoryTemplate(wikitext)
  const stripped = wikitext
    .replace(template, '')
    .split(/\n==/)[0]
    .split('\n[[Category:')[0]

  const paragraphs = stripped
    .split(/\n\n+/)
    .map(cleanInline)
    .filter(Boolean)
    .filter((paragraph) => !/^\[\[Category:/i.test(paragraph))

  return paragraphs[0] || null
}

function extractAccessoryTemplate(wikitext) {
  const start = wikitext.indexOf('{{Accessory')
  if (start === -1) return ''

  let depth = 0

  for (let index = start; index < wikitext.length - 1; index += 1) {
    const pair = wikitext.slice(index, index + 2)

    if (pair === '{{') {
      depth += 1
      index += 1
      continue
    }

    if (pair === '}}') {
      depth -= 1
      index += 1

      if (depth === 0) {
        return wikitext.slice(start, index + 1)
      }
    }
  }

  return ''
}

function parseTradeLevel(value) {
  const clean = cleanInline(value || '')
  if (!clean || clean.includes('?')) return null
  const match = clean.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : null
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanText(text) {
  return text
    .replace(/'''/g, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:Color|color)\|[^|]+\|([^}]+)\}\}/g, '$1')
    .replace(/\{\{ColorN\|[^|]+\|([^}]+)\}\}/g, '$1')
    .replace(/\{\{R\}\}/g, 'Robux')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\(UNOB\)/g, '')
    .replace(/\[NEW\]/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function cleanInline(text) {
  return cleanText(text).replace(/\n+/g, ' ')
}

function normalizeName(name) {
  return cleanInline(name)
    .replace(/’/g, "'")
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readNumber(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)/)
  return match ? toNumber(match[1]) : null
}

function toNumber(value) {
  return Number.parseFloat(String(value).replace(',', '.'))
}

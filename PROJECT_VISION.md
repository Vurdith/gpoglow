# Glow Project Vision

This file is for future AI or human contributors who need to continue the project without the original chat context.

## Core Product Direction

Glow is not meant to stay a simple accessory page.
It is meant to become a broader Grand Piece Online utility site, closer to a better custom wiki plus tools.

Current priority:
- build a strong accessory archive first
- support real wiki-backed data now
- keep the data model ready for a future manual-first workflow after disconnecting from the wiki

## UI Direction

Do not drift back into generic glassmorphism or AI-dashboard styling.
The intended direction is:
- dark, dramatic, anime-leaning presentation
- rough cut-paper / tabbed / tattered wiki energy
- stylized panels and info blocks, but still readable
- performant on small devices, so avoid heavy blur and expensive effects

### Card Rules

Accessory archive cards should be summary-first, not detail-dump cards.
Front of card should focus on:
- slot
- item name
- rarity
- visible stats

Card behavior:
- card itself should not open the detail page on click
- `Open page` button is the explicit path to the detail page
- hover tooltip near cursor should show short overview + obtain/source context
- extra stats beyond the first visible set should live behind a small expandable affordance like `Show additional stats`

### Detail Page Rules

Accessory detail pages are where the heavier metadata belongs:
- availability
- trade level
- dropped by
- location
- drop chance
- source summary
- extra effects
- full stat breakdown

Avoid redundant filler sections like `Quick source line`.
If a field is already represented clearly elsewhere, do not add a second weaker copy of it.

## Data Direction

Current source of truth:
- `src/data/accessories.json`

Adapter layer:
- `src/data/accessories.js`

Sync script:
- `scripts/sync-accessories.mjs`

Current sync strategy uses the GPO Fandom MediaWiki parse API because normal HTML fetches are unreliable / blocked.

The schema should stay ready for:
- `image`
- stats
- description / caption / merged overview
- trade level
- source details
- extra effects
- future manual editing

## Admin Panel Plan

Glow should eventually include a protected admin panel so Reece can maintain the accessory database without relying on the wiki.

### Goals
- password-protected access
- create new accessories
- edit every accessory field
- upload / assign images
- edit stats, rarity, slot, availability, trade level, source, extra effects, description, caption, and any future fields
- support manual records after the wiki sync is retired

### Suggested Architecture
- keep `accessories.json` as the editable content source initially
- add a small authenticated admin route, for example `/admin`
- store a hashed password, never plain text in client code
- long term, move edits behind a small backend or serverless API so credentials and writes are not exposed in the frontend bundle
- start with a local or self-hosted content workflow before attempting multi-user CMS complexity

### Recommended Phases
1. define final editable schema for accessories
2. add admin-only forms for create / edit / delete
3. add image field + upload strategy
4. add save pipeline that writes validated JSON
5. make wiki sync optional, then removable

## UX Notes

- avoid wasted blank space in detail metadata blocks
- long source summaries should use compact note blocks instead of oversized empty cards
- dropdowns and controls must stay readable on dark backgrounds
- sorting should continue supporting ascending and descending for important stats

If you change the UI direction, keep the rough wiki personality intact instead of polishing it into something bland.

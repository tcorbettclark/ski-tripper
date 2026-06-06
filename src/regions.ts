export const REGIONS = [
  'Alps',
  'Andes',
  'Appalachians',
  'Carpathians',
  'Dolomites',
  'Hokkaido',
  'Iceland',
  'Japanese Alps',
  'New Zealand',
  'Pyrenees',
  'Rockies (Canadian)',
  'Rockies (US)',
  'Scandinavia',
  'Scottish Highlands',
  'Sierra Nevada (US)',
  'South Korea',
  'Tatra Mountains',
] as const

export const COMMON_REGIONS: readonly Region[] = [
  'Alps',
  'Appalachians',
  'Japanese Alps',
  'Carpathians',
  'Rockies (US)',
  'Scandinavia',
]

export type Region = (typeof REGIONS)[number]

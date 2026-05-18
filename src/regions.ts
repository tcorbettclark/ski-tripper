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

export type Region = (typeof REGIONS)[number]

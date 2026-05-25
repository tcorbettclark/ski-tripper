export const COUNTRY_CODES: Record<string, string> = {
  'New Zealand': 'NZ',
  'South Korea': 'KR',
  'United States': 'US',
  Andorra: 'AD',
  Argentina: 'AR',
  Australia: 'AU',
  Austria: 'AT',
  Canada: 'CA',
  Chile: 'CL',
  China: 'CN',
  Finland: 'FI',
  France: 'FR',
  Germany: 'DE',
  Greece: 'GR',
  Iceland: 'IS',
  Italy: 'IT',
  Japan: 'JP',
  Norway: 'NO',
  Slovenia: 'SI',
  Spain: 'ES',
  Sweden: 'SE',
  Switzerland: 'CH',
  Turkey: 'TR',
}

export const COUNTRIES = Object.keys(COUNTRY_CODES)
  .filter((name) => !name.includes('_'))
  .sort()

export function getCountryFlagUrl(country: string): string | undefined {
  const code = COUNTRY_CODES[country]
  if (!code) return undefined
  return `/flags/${code.toLowerCase()}.png`
}

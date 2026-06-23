import { Sparkles, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import {
  COMMON_COUNTRIES,
  COUNTRIES,
  getCountryFlagUrl,
} from '../shared/countries'
import { COMMON_REGIONS, REGIONS } from '../shared/regions'
import type { ResortWithEmbedding, User } from '../shared/types.d'
import PisteBreakdown from './PisteBreakdown'
import PreferenceSearchModal from './PreferenceSearchModal'
import ResortDetailModal from './ResortDetailModal'
import type { ScoredResort } from './resortSearch'
import {
  getIsModelFailed as _getIsModelFailed,
  getIsModelReady as _getIsModelReady,
  initSearchModel as _initSearchModel,
  onModelReady as _onModelReady,
  searchResorts as _searchResorts,
} from './resortSearch'
import { trophyGrade } from './resortSearchPure'
import TagCloud from './TagCloud'
import { borders, colors, fontSizes, fonts, mix } from './theme'
import { useDebouncedValue } from './useDebouncedValue'
import { formatTransferTime } from './utils'

interface ResortsProps {
  user: User
  tripId: string
  resorts: ResortWithEmbedding[]
  onNavigateToProposals?: () => void
  onAuthError?: (err: unknown) => void
  initSearchModel?: () => void
  getIsModelReady?: () => boolean
  getIsModelFailed?: () => boolean
  onModelReady?: (callback: () => void) => void
  searchResorts?: (
    query: string,
    resorts: ResortWithEmbedding[]
  ) => Promise<ScoredResort[]>
  searchDebounceMs?: number
  sliderDebounceMs?: number
}

const NOOP_AUTH_ERROR = () => {}

const _defaultInitSearchModel = _initSearchModel
const _defaultGetIsModelReady = _getIsModelReady
const _defaultGetIsModelFailed = _getIsModelFailed
const _defaultOnModelReady = _onModelReady
const _defaultSearchResorts = _searchResorts

export default function Resorts({
  user,
  tripId,
  resorts,
  onNavigateToProposals,
  onAuthError = NOOP_AUTH_ERROR,
  initSearchModel: initSearch = _defaultInitSearchModel,
  getIsModelReady: isModelReady = _defaultGetIsModelReady,
  getIsModelFailed: isModelFailed = _defaultGetIsModelFailed,
  onModelReady: onModelReadyCb = _defaultOnModelReady,
  searchResorts: searchResortsFn = _defaultSearchResorts,
  searchDebounceMs = 300,
  sliderDebounceMs = 150,
}: ResortsProps) {
  initSearch()
  const [searchQuery, setSearchQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<Set<string>>(new Set())
  const [regionFilter, setRegionFilter] = useState<Set<string>>(new Set())
  const [minPisteKm, setMinPisteKm] = useState(0)
  const [minPeakAltitude, setMinPeakHeight] = useState(0)
  const [minBaseAltitude, setMinBaseAltitude] = useState(0)
  const [maxTransferTime, setMaxTransferTime] = useState(-1)
  const [pisteProfiles, setPisteProfiles] = useState<Set<string>>(new Set())
  const [selectedResort, setSelectedResort] =
    useState<ResortWithEmbedding | null>(null)
  const [modelReady, setModelReady] = useState(isModelReady())
  const [modelFailed, setModelFailed] = useState(isModelFailed())
  const [searchResults, setSearchResults] = useState<ScoredResort[] | null>(
    null
  )

  const debouncedSearchQuery = useDebouncedValue(searchQuery, searchDebounceMs)
  const debouncedMinPisteKm = useDebouncedValue(minPisteKm, sliderDebounceMs)
  const debouncedMinPeakAltitude = useDebouncedValue(
    minPeakAltitude,
    sliderDebounceMs
  )
  const debouncedMinBaseAltitude = useDebouncedValue(
    minBaseAltitude,
    sliderDebounceMs
  )
  const debouncedMaxTransferTime = useDebouncedValue(
    maxTransferTime,
    sliderDebounceMs
  )

  useEffect(() => {
    onModelReadyCb(() => {
      setModelReady(isModelReady())
      setModelFailed(isModelFailed())
    })
  }, [onModelReadyCb, isModelReady, isModelFailed])

  const maxTransferTimeFromData = useMemo(
    () =>
      Math.max(
        ...resorts
          .map((r) => r.transferTime)
          .filter((t): t is number => t != null),
        0
      ),
    [resorts]
  )

  useEffect(() => {
    if (maxTransferTime < 0 && maxTransferTimeFromData > 0) {
      setMaxTransferTime(maxTransferTimeFromData)
    }
  }, [maxTransferTimeFromData, maxTransferTime])

  const [showPreferenceSearch, setShowPreferenceSearch] = useState(false)

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults(null)
      return
    }
    if (!modelReady) {
      setSearchResults(null)
      return
    }
    searchResortsFn(debouncedSearchQuery, resorts)
      .then((results) => {
        setSearchResults(results)
      })
      .catch(() => {
        setSearchResults(null)
      })
  }, [debouncedSearchQuery, modelReady, resorts, searchResortsFn])

  const toggleCountry = useCallback((country: string) => {
    setCountryFilter((prev) => {
      const next = new Set(prev)
      if (next.has(country)) next.delete(country)
      else next.add(country)
      return next
    })
  }, [])

  const toggleRegion = useCallback((region: string) => {
    setRegionFilter((prev) => {
      const next = new Set(prev)
      if (next.has(region)) next.delete(region)
      else next.add(region)
      return next
    })
  }, [])

  const countryTagItems = useMemo(() => {
    const common = COMMON_COUNTRIES.map((c) => ({
      key: c,
      label: c,
      imageUrl: getCountryFlagUrl(c),
    }))
    const commonSet = new Set<string>(COMMON_COUNTRIES)
    const uncommon = COUNTRIES.filter((c) => !commonSet.has(c)).map((c) => ({
      key: c,
      label: c,
      imageUrl: getCountryFlagUrl(c),
    }))
    return { common, uncommon }
  }, [])

  const regionTagItems = useMemo(() => {
    const commonSet = new Set(COMMON_REGIONS)
    const common = COMMON_REGIONS.map((r) => ({
      key: r,
      label: r,
    }))
    const uncommon = REGIONS.filter((r) => !commonSet.has(r)).map((r) => ({
      key: r,
      label: r,
    }))
    return { common, uncommon }
  }, [])

  const filteredResorts: ScoredResort[] = useMemo(() => {
    let result: ScoredResort[] = searchResults ?? resorts

    if (countryFilter.size > 0) {
      result = result.filter((r) => countryFilter.has(r.country))
    }

    if (regionFilter.size > 0) {
      result = result.filter((r) => regionFilter.has(r.region))
    }

    if (debouncedMinPisteKm > 0) {
      result = result.filter((r) => r.pisteKm >= debouncedMinPisteKm)
    }

    if (debouncedMinPeakAltitude > 0) {
      result = result.filter(
        (r) => r.summitAltitude >= debouncedMinPeakAltitude
      )
    }

    if (debouncedMinBaseAltitude > 0) {
      result = result.filter((r) => r.baseAltitude >= debouncedMinBaseAltitude)
    }

    if (
      debouncedMaxTransferTime >= 0 &&
      maxTransferTimeFromData > 0 &&
      debouncedMaxTransferTime < maxTransferTimeFromData
    ) {
      result = result.filter(
        (r) =>
          r.transferTime != null && r.transferTime <= debouncedMaxTransferTime
      )
    }

    if (pisteProfiles.size > 0) {
      result = result.filter((r) => {
        let sum = 0
        if (pisteProfiles.has('beginner')) sum += r.beginnerPct
        if (pisteProfiles.has('intermediate')) sum += r.intermediatePct
        if (pisteProfiles.has('advanced')) sum += r.advancedPct
        if (!pisteProfiles.has('beginner') && sum <= r.beginnerPct) return false
        if (!pisteProfiles.has('intermediate') && sum <= r.intermediatePct)
          return false
        if (!pisteProfiles.has('advanced') && sum <= r.advancedPct) return false
        return true
      })
    }

    return result
  }, [
    resorts,
    searchResults,
    countryFilter,
    regionFilter,
    debouncedMinPisteKm,
    debouncedMinPeakAltitude,
    debouncedMinBaseAltitude,
    debouncedMaxTransferTime,
    maxTransferTimeFromData,
    pisteProfiles,
  ])

  const handleRowClick = useCallback((resort: ResortWithEmbedding) => {
    setSelectedResort(resort)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedResort(null)
  }, [])

  const clearLocationFilters = useCallback(() => {
    setCountryFilter(new Set())
    setRegionFilter(new Set())
  }, [])

  const clearSlopeFilters = useCallback(() => {
    setMinPisteKm(0)
    setMinPeakHeight(0)
    setMinBaseAltitude(0)
    setPisteProfiles(new Set())
  }, [])

  const clearTransportFilters = useCallback(() => {
    if (maxTransferTimeFromData > 0) {
      setMaxTransferTime(maxTransferTimeFromData)
    } else {
      setMaxTransferTime(-1)
    }
  }, [maxTransferTimeFromData])

  const hasLocationFilters = countryFilter.size > 0 || regionFilter.size > 0

  const hasSlopeFilters =
    minPisteKm > 0 ||
    minPeakAltitude > 0 ||
    minBaseAltitude > 0 ||
    pisteProfiles.size > 0

  const hasTransportFilters =
    maxTransferTimeFromData > 0 &&
    maxTransferTime >= 0 &&
    maxTransferTime < maxTransferTimeFromData

  const maxScore = useMemo(() => {
    let max = 0
    const source = searchResults ?? []
    for (const r of source) {
      if (r.score != null && r.score > max) max = r.score
    }
    return max
  }, [searchResults])

  if (resorts.length === 0) {
    return (
      <div style={resortsStyles.container}>
        <div style={resortsStyles.toolbar}>
          <h2 style={resortsStyles.heading}>Resorts Catalog</h2>
        </div>
        <p style={resortsStyles.noResortsText}>No resorts available</p>
      </div>
    )
  }

  const columns = [
    { key: 'resortName', label: 'Resort Name', width: '24%' },
    { key: 'country', label: 'Country', width: '12%' },
    { key: 'region', label: 'Region', width: '14%' },
    { key: 'pisteBreakdown', label: 'Piste', width: '12%' },
    { key: 'pisteKm', label: 'Piste Km', width: '10%' },
    { key: 'altitudeRange', label: 'Peak Height', width: '14%' },
    { key: 'skiSeasonMonths', label: 'Season', width: '14%' },
  ] as const

  function getCellValue(resort: ResortWithEmbedding, key: string): string {
    switch (key) {
      case 'resortName':
        return resort.resortName
      case 'country':
        return resort.country
      case 'region':
        return resort.region
      case 'pisteBreakdown':
        return ''
      case 'pisteKm':
        return resort.pisteKm ? String(resort.pisteKm) : ''
      case 'altitudeRange':
        if (resort.baseAltitude && resort.summitAltitude) {
          return `${resort.baseAltitude}m–${resort.summitAltitude}m`
        }
        return ''
      case 'skiSeasonMonths':
        return resort.skiSeasonMonths
      default:
        return ''
    }
  }

  function trophyColorVariant(variant: 'gold' | 'silver' | 'bronze'): string {
    if (variant === 'gold') return colors.medalGold
    if (variant === 'silver') return colors.medalSilver
    return colors.medalBronze
  }

  function matchDotColor(score: number): string {
    const trophy = trophyGrade(score, maxScore)
    if (trophy) return trophyColorVariant(trophy)
    return mix('--color-accent', Math.min(score * 1.4, 1))
  }

  return (
    <div style={resortsStyles.container}>
      <div style={resortsStyles.toolbar}>
        <h2 style={resortsStyles.heading}>Resorts Catalog</h2>
      </div>

      <div style={resortsStyles.filtersGrid}>
        <div style={resortsStyles.searchRow}>
          <div style={resortsStyles.searchInputWrapper}>
            <textarea
              placeholder={
                modelFailed
                  ? 'Search unavailable'
                  : modelReady
                    ? 'Semantic search'
                    : 'Loading search model...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!modelReady}
              rows={1}
              style={{
                ...resortsStyles.searchInput,
                ...(modelReady ? {} : resortsStyles.searchInputDisabled),
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={resortsStyles.searchClearButton}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreferenceSearch(true)}
            style={resortsStyles.preferenceSearchButton}
            title="Search from preferences"
          >
            <Sparkles size={14} />
          </button>
        </div>
        <fieldset style={resortsStyles.filterGroup}>
          <legend style={resortsStyles.filterGroupLabel}>Location</legend>
          {hasLocationFilters && (
            <button
              type="button"
              onClick={clearLocationFilters}
              style={resortsStyles.groupClearButton}
              aria-label="Clear location filters"
            >
              ×
            </button>
          )}
          <div style={resortsStyles.filterRow}>
            <TagCloud
              commonItems={countryTagItems.common}
              uncommonItems={countryTagItems.uncommon}
              selectedKeys={countryFilter}
              onToggle={toggleCountry}
            />
            <TagCloud
              commonItems={regionTagItems.common}
              uncommonItems={regionTagItems.uncommon}
              selectedKeys={regionFilter}
              onToggle={toggleRegion}
            />
          </div>
        </fieldset>
        <fieldset style={resortsStyles.filterGroup}>
          <legend style={resortsStyles.filterGroupLabel}>
            Slope &amp; terrain
          </legend>
          {hasSlopeFilters && (
            <button
              type="button"
              onClick={clearSlopeFilters}
              style={resortsStyles.groupClearButton}
              aria-label="Clear slope and terrain filters"
            >
              ×
            </button>
          )}
          <div style={resortsStyles.filterRow}>
            <div style={resortsStyles.sliderGroup}>
              <label
                htmlFor="min-piste-km-slider"
                style={resortsStyles.sliderLabel}
              >
                Min Piste Km
              </label>
              <input
                id="min-piste-km-slider"
                type="range"
                min={0}
                max={250}
                step={10}
                value={minPisteKm}
                onChange={(e) => setMinPisteKm(Number(e.target.value))}
                style={resortsStyles.slider}
              />
              <span style={resortsStyles.sliderValue}>
                {minPisteKm > 0 ? minPisteKm : 'Any'}
              </span>
            </div>
            <div style={resortsStyles.sliderGroup}>
              <label
                htmlFor="min-base-altitude-slider"
                style={resortsStyles.sliderLabel}
              >
                Min Resort Alt
              </label>
              <input
                id="min-base-altitude-slider"
                type="range"
                min={0}
                max={2500}
                step={100}
                value={minBaseAltitude}
                onChange={(e) => setMinBaseAltitude(Number(e.target.value))}
                style={resortsStyles.slider}
              />
              <span style={resortsStyles.sliderValue}>
                {minBaseAltitude > 0 ? `${minBaseAltitude}m` : 'Any'}
              </span>
            </div>
            <div style={resortsStyles.sliderGroup}>
              <label
                htmlFor="min-peak-height-slider"
                style={resortsStyles.sliderLabel}
              >
                Min Peak Alt
              </label>
              <input
                id="min-peak-height-slider"
                type="range"
                min={0}
                max={3500}
                step={100}
                value={minPeakAltitude}
                onChange={(e) => setMinPeakHeight(Number(e.target.value))}
                style={resortsStyles.slider}
              />
              <span style={resortsStyles.sliderValue}>
                {minPeakAltitude > 0 ? `${minPeakAltitude}m` : 'Any'}
              </span>
            </div>
            <div style={resortsStyles.sliderGroup}>
              <div style={resortsStyles.terrainButtons}>
                {[
                  {
                    value: 'beginner' as const,
                    label: 'Beginner',
                    colour: colors.pisteBeginner,
                  },
                  {
                    value: 'intermediate' as const,
                    label: 'Intermediate',
                    colour: colors.pisteIntermediate,
                  },
                  {
                    value: 'advanced' as const,
                    label: 'Advanced',
                    colour: colors.pisteAdvanced,
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setPisteProfiles((prev) => {
                        const next = new Set(prev)
                        if (next.has(opt.value)) next.delete(opt.value)
                        else next.add(opt.value)
                        return next
                      })
                    }
                    style={{
                      ...resortsStyles.pisteProfileButton,
                      background: pisteProfiles.has(opt.value)
                        ? opt.colour
                        : 'transparent',
                      color: pisteProfiles.has(opt.value) ? '#fff' : opt.colour,
                      border: `1px solid ${opt.colour}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>
        {maxTransferTimeFromData > 0 && (
          <fieldset style={resortsStyles.filterGroup}>
            <legend style={resortsStyles.filterGroupLabel}>Transport</legend>
            {hasTransportFilters && (
              <button
                type="button"
                onClick={clearTransportFilters}
                style={resortsStyles.groupClearButton}
                aria-label="Clear transport filters"
              >
                ×
              </button>
            )}
            <div style={resortsStyles.filterRow}>
              <div style={resortsStyles.sliderGroup}>
                <label
                  htmlFor="max-transfer-time-slider"
                  style={resortsStyles.sliderLabel}
                >
                  Max Transfer Time
                </label>
                <input
                  id="max-transfer-time-slider"
                  type="range"
                  min={0}
                  max={maxTransferTimeFromData}
                  step={5}
                  value={
                    maxTransferTime < 0
                      ? maxTransferTimeFromData
                      : maxTransferTime
                  }
                  onChange={(e) => setMaxTransferTime(Number(e.target.value))}
                  style={resortsStyles.slider}
                />
                <span style={resortsStyles.sliderValue}>
                  {maxTransferTime >= 0 &&
                  maxTransferTime < maxTransferTimeFromData
                    ? formatTransferTime(maxTransferTime)
                    : 'Any'}
                </span>
              </div>
            </div>
          </fieldset>
        )}
      </div>

      <div style={resortsStyles.resultCount}>
        {filteredResorts.length} of {resorts.length} resorts
      </div>

      <div style={resortsStyles.tableContainer}>
        <style>{`.resorts-table tr:hover td { background: ${mix('--color-accent', 0.25)}; cursor: pointer; }`}</style>
        <TableVirtuoso
          data={filteredResorts}
          components={{
            Table: ({ style, ...props }) => (
              <table
                {...props}
                className="resorts-table"
                style={{ ...style, width: '100%', borderCollapse: 'collapse' }}
              />
            ),
          }}
          fixedHeaderContent={() => (
            <tr style={resortsStyles.headerRow}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...resortsStyles.th, width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          )}
          itemContent={(_index, resort) => (
            <>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    ...resortsStyles.td,
                    width: col.width,
                  }}
                  onClick={() => handleRowClick(resort)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      handleRowClick(resort)
                  }}
                  tabIndex={col.key === 'resortName' ? 0 : -1}
                >
                  {col.key === 'resortName' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {resort.score != null &&
                      trophyGrade(resort.score, maxScore) != null ? (
                        <Trophy
                          size={14}
                          style={{
                            color: trophyColorVariant(
                              trophyGrade(resort.score, maxScore)!
                            ),
                            flexShrink: 0,
                          }}
                        />
                      ) : resort.score != null ? (
                        <span
                          style={{
                            display: 'inline-block',
                            width: `${6 + resort.score * 10}px`,
                            height: `${6 + resort.score * 10}px`,
                            minWidth: '6px',
                            minHeight: '6px',
                            borderRadius: '50%',
                            background: matchDotColor(resort.score),
                            flexShrink: 0,
                          }}
                        />
                      ) : null}
                      {resort.resortName}
                    </span>
                  ) : col.key === 'country' &&
                    resort.country &&
                    getCountryFlagUrl(resort.country) ? (
                    <img
                      src={getCountryFlagUrl(resort.country)}
                      alt={resort.country}
                      style={resortsStyles.countryFlag}
                    />
                  ) : col.key === 'pisteBreakdown' ? (
                    <PisteBreakdown
                      beginnerPct={resort.beginnerPct}
                      intermediatePct={resort.intermediatePct}
                      advancedPct={resort.advancedPct}
                      compact
                    />
                  ) : (
                    getCellValue(resort, col.key)
                  )}
                </td>
              ))}
            </>
          )}
        />
      </div>

      {selectedResort && (
        <ResortDetailModal
          resort={selectedResort}
          tripId={tripId}
          user={user}
          onClose={handleCloseDetail}
          onNavigateToProposals={onNavigateToProposals}
          onAuthError={onAuthError}
        />
      )}

      {showPreferenceSearch && (
        <PreferenceSearchModal
          tripId={tripId}
          onClose={() => setShowPreferenceSearch(false)}
          onSearch={(query) => setSearchQuery(query)}
        />
      )}
    </div>
  )
}

const resortsStyles = {
  container: {
    padding: '40px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: borders.subtle,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  navButtonSmall: {
    marginLeft: '8px',
    padding: '4px 12px',
    borderRadius: '4px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    cursor: 'pointer',
  },
  noResortsText: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    margin: 0,
  },
  filtersGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    marginBottom: '16px',
  },
  searchRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  preferenceSearchButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    borderRadius: '8px',
    border: `1px solid ${mix('--color-accent', 0.3)}`,
    background: 'transparent',
    color: colors.accent,
    cursor: 'pointer',
    flexShrink: 0,
  },
  searchInputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
  },
  searchInput: {
    padding: '12px 36px 12px 16px',
    borderRadius: '10px',
    border: borders.accent,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    resize: 'none' as const,
    overflow: 'hidden' as const,
    lineHeight: '1.5' as const,
    fieldSizing: 'content' as const,
    minHeight: '44px',
  },
  searchInputDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  searchClearButton: {
    position: 'absolute' as const,
    right: '8px',
    top: '12px',
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  filterGroup: {
    border: borders.subtle,
    borderRadius: '8px',
    padding: '14px 16px',
    background: 'transparent',
    margin: 0,
    position: 'relative' as const,
  },
  filterGroupLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    padding: '0 6px',
  },
  groupClearButton: {
    position: 'absolute' as const,
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: fontSizes.base,
    cursor: 'pointer',
    padding: '0 4px',
    marginLeft: '6px',
    lineHeight: 1,
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  filterSelect: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
    cursor: 'pointer',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    minWidth: '140px',
  },
  sliderLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  slider: {
    width: '140px',
  },
  sliderValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    letterSpacing: '0.02em',
  },
  pisteProfileLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  terrainGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    alignItems: 'center' as const,
  },
  terrainButtons: {
    display: 'flex',
    gap: '6px',
  },
  pisteProfileButton: {
    padding: '6px 14px',
    borderRadius: '14px',
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },

  resultCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: '12px',
  },
  tableContainer: {
    borderRadius: '10px',
    border: borders.card,
    overflow: 'hidden',
    background: colors.bgCard,
    height: 'calc(100dvh - 300px)',
    minHeight: '300px',
  },
  headerRow: {
    background: colors.bgCard,
  },
  th: {
    padding: '12px 16px',
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    borderBottom: borders.subtle,
    whiteSpace: 'nowrap' as const,
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
    background: colors.bgCard,
  },
  td: {
    padding: '10px 16px',
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  },
  countryFlag: {
    display: 'inline-block',
    width: '22px',
    height: '15px',
    verticalAlign: 'middle',
  },
} as const

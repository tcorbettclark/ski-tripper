import { MapPin, Sparkles, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import {
  COMMON_COUNTRIES,
  COUNTRIES,
  getCountryFlagUrl,
} from '../shared/countries'
import { COMMON_REGIONS, REGIONS } from '../shared/regions'
import type { ResortWithEmbedding, User } from '../shared/types.d'
import DateRangeField from './DateRangeField'
import DetailField from './DetailField'
import Paragraphs from './Paragraphs'
import PisteBreakdown from './PisteBreakdown'
import PreferenceSearchPopup from './PreferenceSearchPopup'
import type { ScoredResort } from './resortSearch'
import {
  getIsModelReady,
  initSearchModel,
  onModelReady,
  searchResorts,
} from './resortSearch'
import {
  TROPHY_BRONZE_THRESHOLD,
  TROPHY_GOLD_THRESHOLD,
  TROPHY_SILVER_THRESHOLD,
} from './resortSearchPure'
import TagCloud from './TagCloud'
import {
  borders,
  colors,
  detailStyles,
  fontSizes,
  fonts,
  formStyles,
  mix,
} from './theme'
import { ensureUrlScheme, formatTransferTime, sanitizeUrl } from './utils'

initSearchModel()

const snowReliabilityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface ResortsProps {
  user: User
  tripId: string
  resorts: ResortWithEmbedding[]
  onNavigateToProposals?: () => void
  onAuthError?: (err: unknown) => void
}

const NOOP_AUTH_ERROR = () => {}

export default function Resorts({
  user,
  tripId,
  resorts,
  onNavigateToProposals,
  onAuthError = NOOP_AUTH_ERROR,
}: ResortsProps) {
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
  const [modelReady, setModelReady] = useState(getIsModelReady())
  const [searchResults, setSearchResults] = useState<ScoredResort[] | null>(
    null
  )

  useEffect(() => {
    onModelReady(() => setModelReady(getIsModelReady()))
  }, [])

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

  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalSaving, setProposalSaving] = useState(false)
  const [proposalSuccess, setProposalSuccess] = useState(false)
  const [proposalSuccessName, setProposalSuccessName] = useState('')
  const [hoveredWebsite, setHoveredWebsite] = useState<string | null>(null)
  const [showPreferenceSearch, setShowPreferenceSearch] = useState(false)

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    if (!modelReady) {
      setSearchResults(null)
      return
    }
    const filteredByDropdowns = resorts.filter((r) => {
      if (countryFilter.size > 0 && !countryFilter.has(r.country)) return false
      if (regionFilter.size > 0 && !regionFilter.has(r.region)) return false
      if (minPisteKm > 0 && r.pisteKm < minPisteKm) return false
      if (minPeakAltitude > 0 && r.summitAltitude < minPeakAltitude)
        return false
      if (minBaseAltitude > 0 && r.baseAltitude < minBaseAltitude) return false
      if (
        maxTransferTime >= 0 &&
        maxTransferTime < maxTransferTimeFromData &&
        (r.transferTime == null || r.transferTime > maxTransferTime)
      )
        return false
      if (pisteProfiles.size > 0) {
        let sum = 0
        if (pisteProfiles.has('beginner')) sum += r.beginnerPct
        if (pisteProfiles.has('intermediate')) sum += r.intermediatePct
        if (pisteProfiles.has('advanced')) sum += r.advancedPct
        if (!pisteProfiles.has('beginner') && sum <= r.beginnerPct) return false
        if (!pisteProfiles.has('intermediate') && sum <= r.intermediatePct)
          return false
        if (!pisteProfiles.has('advanced') && sum <= r.advancedPct) return false
      }
      return true
    })
    searchResorts(searchQuery, filteredByDropdowns)
      .then((results) => {
        setSearchResults(results)
      })
      .catch(() => {
        setSearchResults(null)
      })
  }, [
    searchQuery,
    modelReady,
    resorts,
    countryFilter,
    regionFilter,
    minPisteKm,
    minPeakAltitude,
    minBaseAltitude,
    maxTransferTime,
    maxTransferTimeFromData,
    pisteProfiles,
  ])

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
    if (searchResults !== null) {
      return searchResults
    }

    let result: ScoredResort[] = resorts

    if (countryFilter.size > 0) {
      result = result.filter((r) => countryFilter.has(r.country))
    }

    if (regionFilter.size > 0) {
      result = result.filter((r) => regionFilter.has(r.region))
    }

    if (minPisteKm > 0) {
      result = result.filter((r) => r.pisteKm >= minPisteKm)
    }

    if (minPeakAltitude > 0) {
      result = result.filter((r) => r.summitAltitude >= minPeakAltitude)
    }

    if (minBaseAltitude > 0) {
      result = result.filter((r) => r.baseAltitude >= minBaseAltitude)
    }

    if (
      maxTransferTime >= 0 &&
      maxTransferTimeFromData > 0 &&
      maxTransferTime < maxTransferTimeFromData
    ) {
      result = result.filter(
        (r) => r.transferTime != null && r.transferTime <= maxTransferTime
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
    minPisteKm,
    minPeakAltitude,
    minBaseAltitude,
    maxTransferTime,
    maxTransferTimeFromData,
    pisteProfiles,
  ])

  const handleRowClick = useCallback((resort: ResortWithEmbedding) => {
    setSelectedResort(resort)
    setShowProposalForm(false)
    setProposalError('')
    setProposalSuccess(false)
    setProposalSuccessName('')
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedResort(null)
    setShowProposalForm(false)
    setProposalError('')
    setProposalSuccess(false)
    setProposalSuccessName('')
  }, [])

  const handleProposeResort = useCallback(() => {
    setShowProposalForm(true)
    setProposalError('')
    setProposalSuccess(false)
    setProposalSuccessName('')
  }, [])

  const handleSubmitProposal = useCallback(
    async (
      e: React.FormEvent,
      resort: ResortWithEmbedding,
      startDate: string,
      endDate: string,
      description: string,
      customResortName?: string
    ) => {
      e.preventDefault()
      if (!tripId) return
      setProposalSaving(true)
      setProposalError('')
      try {
        const { createProposal } = await import('./backend')
        await createProposal(tripId, user.id, user.name, {
          description,
          startDate,
          endDate,
          resortData: {
            resortName: customResortName || resort.resortName,
            country: resort.country,
            region: resort.region,
            summitAltitude: resort.summitAltitude,
            baseAltitude: resort.baseAltitude,
            nearestAirport: resort.nearestAirport,
            transferTime: resort.transferTime,
            pisteKm: resort.pisteKm,
            beginnerPct: resort.beginnerPct,
            intermediatePct: resort.intermediatePct,
            advancedPct: resort.advancedPct,
            liftCount: resort.liftCount,
            snowReliability: resort.snowReliability,
            skiSeasonMonths: resort.skiSeasonMonths,
            websites: resort.websites,
            latitude: resort.latitude,
            longitude: resort.longitude,
            linkedResortsDescription: resort.linkedResortsDescription,
          },
        })
        setProposalSuccessName(customResortName || resort.resortName)
        setProposalSuccess(true)
      } catch (err: unknown) {
        setProposalError(err instanceof Error ? err.message : String(err))
      } finally {
        setProposalSaving(false)
      }
    },
    [tripId, user.id, user.name]
  )

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

  function trophyIcon(score: number): 'gold' | 'silver' | 'bronze' | null {
    if (score >= TROPHY_GOLD_THRESHOLD) return 'gold'
    if (score >= TROPHY_SILVER_THRESHOLD) return 'silver'
    if (score >= TROPHY_BRONZE_THRESHOLD) return 'bronze'
    return null
  }

  function trophyColorVariant(variant: 'gold' | 'silver' | 'bronze'): string {
    if (variant === 'gold') return colors.medalGold
    if (variant === 'silver') return colors.medalSilver
    return colors.medalBronze
  }

  function matchDotColor(score: number): string {
    const trophy = trophyIcon(score)
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
                modelReady
                  ? 'Semantic search (more words are better)'
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
                max={600}
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
                htmlFor="min-peak-height-slider"
                style={resortsStyles.sliderLabel}
              >
                Min Peak Alt
              </label>
              <input
                id="min-peak-height-slider"
                type="range"
                min={0}
                max={5000}
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
                max={4000}
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
                      {resort.score != null && (
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
                      )}
                      {resort.resortName}
                      {resort.score != null &&
                        trophyIcon(resort.score) != null && (
                          <Trophy
                            size={14}
                            style={{
                              color: trophyColorVariant(
                                trophyIcon(resort.score)!
                              ),
                              flexShrink: 0,
                            }}
                          />
                        )}
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
        <div
          role="dialog"
          aria-modal="true"
          style={resortsStyles.overlay}
          onClick={handleCloseDetail}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseDetail()
          }}
        >
          <div
            role="document"
            style={resortsStyles.detailPopup}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div style={resortsStyles.detailHeader}>
              <h3 style={detailStyles.title}>
                {proposalSuccess ? (
                  `Created proposal for ${proposalSuccessName}`
                ) : (
                  <>
                    {(() => {
                      const flagUrl =
                        selectedResort.country &&
                        getCountryFlagUrl(selectedResort.country)
                      return flagUrl ? (
                        <img
                          src={flagUrl}
                          alt={selectedResort.country}
                          style={resortsStyles.flag}
                        />
                      ) : null
                    })()}
                    {selectedResort.resortName || '—'}
                    {selectedResort.country
                      ? ` in ${selectedResort.region ? `${selectedResort.region}, ` : ''}${selectedResort.country}`
                      : selectedResort.region
                        ? ` in ${selectedResort.region}`
                        : ''}
                    {selectedResort.latitude && selectedResort.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedResort.latitude},${selectedResort.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={resortsStyles.mapPinLink}
                        aria-label="Open in Google Maps"
                      >
                        <MapPin size={16} />
                      </a>
                    )}
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={handleCloseDetail}
                style={resortsStyles.detailCloseButton}
              >
                ×
              </button>
            </div>

            {!showProposalForm && !proposalSuccess && (
              <>
                <div style={resortsStyles.detailGrid}>
                  <DetailField
                    label="Altitude Range"
                    value={
                      selectedResort.baseAltitude &&
                      selectedResort.summitAltitude
                        ? `${selectedResort.baseAltitude}m – ${selectedResort.summitAltitude}m`
                        : ''
                    }
                  />
                  <DetailField
                    label="Piste"
                    value={
                      selectedResort.pisteKm
                        ? `${selectedResort.pisteKm} km`
                        : ''
                    }
                  />
                  <DetailField label="Piste Breakdown">
                    <PisteBreakdown
                      beginnerPct={selectedResort.beginnerPct}
                      intermediatePct={selectedResort.intermediatePct}
                      advancedPct={selectedResort.advancedPct}
                    />
                  </DetailField>
                  <DetailField
                    label="Lifts"
                    value={
                      selectedResort.liftCount
                        ? String(selectedResort.liftCount)
                        : ''
                    }
                  />
                  <DetailField
                    label="Snow Reliability"
                    value={
                      snowReliabilityLabels[selectedResort.snowReliability] ??
                      selectedResort.snowReliability
                    }
                  />
                  <DetailField
                    label="Ski Season"
                    value={selectedResort.skiSeasonMonths}
                  />
                  <DetailField
                    label="Nearest Airport"
                    value={selectedResort.nearestAirport}
                  />
                  <DetailField
                    label="Transfer Time"
                    value={formatTransferTime(selectedResort.transferTime)}
                  />
                  {selectedResort.websites &&
                    selectedResort.websites.length > 0 && (
                      <DetailField
                        label="Websites"
                        style={{ gridColumn: 'span 2' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          {selectedResort.websites.map((url) => (
                            <a
                              key={url}
                              href={sanitizeUrl(ensureUrlScheme(url))}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                ...detailStyles.websiteLink,
                                textDecoration:
                                  hoveredWebsite === url ? 'underline' : 'none',
                              }}
                              onMouseEnter={() => setHoveredWebsite(url)}
                              onMouseLeave={() => setHoveredWebsite(null)}
                            >
                              {ensureUrlScheme(url).replace(/^https?:\/\//, '')}
                            </a>
                          ))}
                        </div>
                      </DetailField>
                    )}
                </div>

                {selectedResort.linkedResortsDescription && (
                  <div style={resortsStyles.detailDescriptionSection}>
                    <DetailField label="Linked Resorts">
                      <Paragraphs
                        text={selectedResort.linkedResortsDescription}
                        style={detailStyles.descriptionText}
                      />
                    </DetailField>
                  </div>
                )}

                {selectedResort.description && (
                  <div style={resortsStyles.detailDescriptionSection}>
                    <DetailField label="Description">
                      <Paragraphs
                        text={selectedResort.description}
                        style={detailStyles.descriptionText}
                      />
                    </DetailField>
                  </div>
                )}
              </>
            )}

            {!showProposalForm && !proposalSuccess && (
              <button
                type="button"
                onClick={handleProposeResort}
                style={resortsStyles.proposeButton}
              >
                Propose this resort
              </button>
            )}

            {proposalSuccess && (
              <div style={resortsStyles.successPopup}>
                <div style={resortsStyles.successButtons}>
                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    style={resortsStyles.successButtonSecondary}
                  >
                    Stay in resorts
                  </button>
                  {onNavigateToProposals && (
                    <button
                      type="button"
                      onClick={onNavigateToProposals}
                      style={resortsStyles.successButtonPrimary}
                    >
                      View in proposals
                    </button>
                  )}
                </div>
              </div>
            )}

            {showProposalForm && !proposalSuccess && (
              <ProposalForm
                resort={selectedResort}
                saving={proposalSaving}
                error={proposalError}
                onSubmit={handleSubmitProposal}
                onCancel={() => {
                  setShowProposalForm(false)
                  setProposalError('')
                }}
                onAuthError={onAuthError}
                tripId={tripId}
                userId={user.id}
              />
            )}
          </div>
        </div>
      )}

      {showPreferenceSearch && (
        <PreferenceSearchPopup
          tripId={tripId}
          onClose={() => setShowPreferenceSearch(false)}
          onSearch={(query) => setSearchQuery(query)}
          onAuthError={onAuthError}
        />
      )}
    </div>
  )
}

interface ProposalFormProps {
  resort: ResortWithEmbedding
  saving: boolean
  error: string
  onSubmit: (
    e: React.FormEvent,
    resort: ResortWithEmbedding,
    startDate: string,
    endDate: string,
    description: string,
    customResortName?: string
  ) => Promise<void>
  onCancel: () => void
  onAuthError?: (err: unknown) => void
  tripId: string
  userId: string
}

function ProposalForm({
  resort,
  saving,
  error,
  onSubmit,
  onCancel,
}: ProposalFormProps) {
  const [resortName, setResortName] = useState(resort.resortName)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState(resort.description || '')
  const [dateError, setDateError] = useState('')

  return (
    <form
      onSubmit={(e) => {
        if (!startDate || !endDate) {
          e.preventDefault()
          setDateError('Please select both a start and end date')
          return
        }
        setDateError('')
        onSubmit(e, resort, startDate, endDate, description, resortName)
      }}
      style={resortsStyles.proposalForm}
    >
      <p style={resortsStyles.proposalFormSubtitle}>
        {resort.country}
        {resort.region ? `, ${resort.region}` : ''}
      </p>
      <div style={{ ...resortsStyles.proposalFormField, marginTop: '16px' }}>
        <label
          htmlFor="proposal-resort-name"
          style={resortsStyles.proposalFormLabel}
        >
          Proposal name (e.g. the resort name)
        </label>
        <input
          id="proposal-resort-name"
          type="text"
          value={resortName}
          onChange={(e) => setResortName(e.target.value)}
          required
          style={resortsStyles.proposalFormInput}
        />
      </div>
      <DateRangeField
        startDate={startDate}
        endDate={endDate}
        onChange={(sd, ed) => {
          setStartDate(sd)
          setEndDate(ed)
          if (sd && ed) setDateError('')
        }}
        error={dateError}
      />
      <div style={resortsStyles.proposalFormField}>
        <label
          htmlFor="proposal-description"
          style={resortsStyles.proposalFormLabel}
        >
          Description
        </label>
        <textarea
          id="proposal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={resortsStyles.proposalFormTextarea}
          placeholder="Describe the trip idea..."
          rows={12}
        />
      </div>
      {error && <p style={formStyles.error}>{error}</p>}
      <div style={resortsStyles.proposalFormActions}>
        <button type="submit" disabled={saving} style={formStyles.saveButton}>
          {saving ? 'Creating draft...' : 'Create Draft Proposal'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={formStyles.cancelButton}
        >
          Cancel
        </button>
      </div>
    </form>
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
    height: 'calc(100vh - 300px)',
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
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--color-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  detailPopup: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '95vh',
    overflowY: 'auto' as const,
    margin: '16px',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  mapPinLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: colors.accent,
    textDecoration: 'none',
  },
  detailCloseButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: fontSizes.xl,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
    marginBottom: '16px',
  },
  countryFlag: {
    display: 'inline-block',
    width: '22px',
    height: '15px',
    verticalAlign: 'middle',
  },
  flag: {
    display: 'inline-block',
    width: '20px',
    height: '14px',
  },
  detailDescriptionSection: {
    marginTop: '6px',
    marginBottom: '16px',
  },
  proposeButton: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  successPopup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '20px',
    padding: '24px 0',
  },
  successButtons: {
    display: 'flex',
    gap: '12px',
  },
  successButtonPrimary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
  },
  successButtonSecondary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: `1px solid ${colors.accent}`,
    background: 'transparent',
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
  },
  proposalForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  proposalFormTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  proposalFormSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: '-12px 0 0',
  },
  proposalFormRow: {
    display: 'flex',
    gap: '12px',
  },
  proposalFormField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: '1 1 auto',
  },
  proposalFormLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  proposalFormInput: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
  },
  proposalFormTextarea: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    outline: 'none',
    resize: 'vertical' as const,
  },
  proposalFormActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end' as const,
    gap: '12px',
    marginTop: '8px',
  },
} as const

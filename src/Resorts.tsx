import type { Models } from 'appwrite'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TableVirtuoso } from 'react-virtuoso'
import DateRangeField from './DateRangeField'
import { borders, colors, fonts, formStyles } from './theme'
import type { Resort } from './types.d.ts'

interface ResortsProps {
  user: Models.User
  tripId: string
  resorts: Resort[]
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
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [minPisteKm, setMinPisteKm] = useState(0)
  const [selectedResort, setSelectedResort] = useState<Resort | null>(null)
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalError, setProposalError] = useState('')
  const [proposalSaving, setProposalSaving] = useState(false)
  const [proposalSuccess, setProposalSuccess] = useState(false)
  const [proposalSuccessName, setProposalSuccessName] = useState('')
  const [websiteHovered, setWebsiteHovered] = useState(false)
  const [latLngHovered, setLatLngHovered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const countryOptions = useMemo(
    () => [...new Set(resorts.map((r) => r.country).filter(Boolean))].sort(),
    [resorts]
  )

  const regionOptions = useMemo(
    () => [...new Set(resorts.map((r) => r.region).filter(Boolean))].sort(),
    [resorts]
  )

  const filteredResorts = useMemo(() => {
    let result = resorts

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase().trim()
      result = result.filter(
        (r) =>
          r.resortName?.toLowerCase().includes(q) ||
          r.country?.toLowerCase().includes(q) ||
          r.region?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      )
    }

    if (countryFilter) {
      result = result.filter((r) => r.country === countryFilter)
    }

    if (regionFilter) {
      result = result.filter((r) => r.region === regionFilter)
    }

    if (minPisteKm > 0) {
      result = result.filter((r) => r.pisteKm >= minPisteKm)
    }

    return result
  }, [resorts, debouncedQuery, countryFilter, regionFilter, minPisteKm])

  const handleRowClick = useCallback((resort: Resort) => {
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
      resort: Resort,
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
        const account = (await import('./backend')).account
        const userAccount = await account.get()
        await createProposal(tripId, user.$id, userAccount.name, {
          description,
          startDate,
          endDate,
          resortData: {
            resortName: customResortName || resort.resortName,
            country: resort.country,
            region: resort.region,
            topAltitude: resort.topAltitude,
            bottomAltitude: resort.bottomAltitude,
            nearestAirport: resort.nearestAirport,
            transferTime: resort.transferTime,
            pisteKm: resort.pisteKm,
            difficulty: resort.difficulty,
            liftCount: resort.liftCount,
            snowReliability: resort.snowReliability,
            skiSeasonMonths: resort.skiSeasonMonths,
            websiteUrl: resort.websiteUrl,
            latitude: resort.latitude,
            longitude: resort.longitude,
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
    [tripId, user.$id]
  )

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setCountryFilter('')
    setRegionFilter('')
    setMinPisteKm(0)
  }, [])

  if (resorts.length === 0) {
    return (
      <div style={resortsStyles.container}>
        <div style={resortsStyles.toolbar}>
          <h2 style={resortsStyles.heading}>Resorts Catalog</h2>
        </div>
        <p style={resortsStyles.loading}>Loading resorts...</p>
      </div>
    )
  }

  const columns = [
    { key: 'resortName', label: 'Resort Name', width: '28%' },
    { key: 'country', label: 'Country', width: '14%' },
    { key: 'region', label: 'Region', width: '16%' },
    { key: 'pisteKm', label: 'Piste Km', width: '12%' },
    { key: 'altitudeRange', label: 'Altitude Range', width: '16%' },
    { key: 'skiSeasonMonths', label: 'Season', width: '14%' },
  ] as const

  function getCellValue(resort: Resort, key: string): string {
    switch (key) {
      case 'resortName':
        return resort.resortName
      case 'country':
        return resort.country
      case 'region':
        return resort.region
      case 'pisteKm':
        return resort.pisteKm ? String(resort.pisteKm) : ''
      case 'altitudeRange':
        if (resort.bottomAltitude && resort.topAltitude) {
          return `${resort.bottomAltitude}m–${resort.topAltitude}m`
        }
        return ''
      case 'skiSeasonMonths':
        return resort.skiSeasonMonths
      default:
        return ''
    }
  }

  const hasActiveFilters =
    searchQuery || countryFilter || regionFilter || minPisteKm > 0

  return (
    <div style={resortsStyles.container}>
      <div style={resortsStyles.toolbar}>
        <h2 style={resortsStyles.heading}>Resorts Catalog</h2>
      </div>

      <div style={resortsStyles.controlsRow}>
        <input
          type="text"
          placeholder="Search resorts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={resortsStyles.searchInput}
        />
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={resortsStyles.filterSelect}
        >
          <option value="">All Countries</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          style={resortsStyles.filterSelect}
        >
          <option value="">All Regions</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <div style={resortsStyles.sliderGroup}>
          <label
            htmlFor="min-piste-km-slider"
            style={resortsStyles.sliderLabel}
          >
            Min Piste Km: {minPisteKm}
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
        </div>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          style={{
            ...resortsStyles.clearButton,
            ...(hasActiveFilters
              ? resortsStyles.clearButtonEnabled
              : resortsStyles.clearButtonDisabled),
          }}
        >
          Clear filters
        </button>
      </div>

      <div style={resortsStyles.resultCount}>
        {filteredResorts.length} of {resorts.length} resorts
      </div>

      <div style={resortsStyles.tableContainer}>
        <TableVirtuoso
          data={filteredResorts}
          components={{
            Table: ({ style, ...props }) => (
              <table
                {...props}
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
                    cursor: 'pointer',
                  }}
                  onClick={() => handleRowClick(resort)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      handleRowClick(resort)
                  }}
                  tabIndex={col.key === 'resortName' ? 0 : -1}
                >
                  {col.key === 'resortName'
                    ? resort.resortName
                    : getCellValue(resort, col.key)}
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
              <h3 style={resortsStyles.detailTitle}>
                {proposalSuccess
                  ? `Created proposal for ${proposalSuccessName}`
                  : selectedResort.resortName}
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
                  <DetailField label="Country" value={selectedResort.country} />
                  <DetailField label="Region" value={selectedResort.region} />
                  <DetailField
                    label="Piste Km"
                    value={
                      selectedResort.pisteKm
                        ? String(selectedResort.pisteKm)
                        : ''
                    }
                  />
                  <DetailField
                    label="Altitude Range"
                    value={
                      selectedResort.bottomAltitude &&
                      selectedResort.topAltitude
                        ? `${selectedResort.bottomAltitude}m–${selectedResort.topAltitude}m`
                        : ''
                    }
                  />
                  <DetailField
                    label="Nearest Airport"
                    value={selectedResort.nearestAirport}
                  />
                  <DetailField
                    label="Transfer Time"
                    value={selectedResort.transferTime}
                  />
                  <DetailField
                    label="Difficulty"
                    value={selectedResort.difficulty}
                  />
                  <DetailField
                    label="Lift Count"
                    value={
                      selectedResort.liftCount
                        ? String(selectedResort.liftCount)
                        : ''
                    }
                  />
                  <DetailField
                    label="Snow Reliability"
                    value={selectedResort.snowReliability}
                  />
                  <DetailField
                    label="Ski Season"
                    value={selectedResort.skiSeasonMonths}
                  />
                  <DetailField label="Latitude/longitude">
                    {selectedResort.latitude || selectedResort.longitude ? (
                      <a
                        href={`https://www.google.com/maps?q=${selectedResort.latitude},${selectedResort.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...resortsStyles.websiteLinkInline,
                          color: colors.accent,
                          textDecoration: latLngHovered ? 'underline' : 'none',
                        }}
                        onMouseEnter={() => setLatLngHovered(true)}
                        onMouseLeave={() => setLatLngHovered(false)}
                      >
                        {selectedResort.latitude}, {selectedResort.longitude}
                      </a>
                    ) : (
                      '—'
                    )}
                  </DetailField>
                  {selectedResort.websiteUrl && (
                    <DetailField label="Website">
                      <a
                        href={selectedResort.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...resortsStyles.websiteLinkInline,
                          textDecoration: websiteHovered ? 'underline' : 'none',
                        }}
                        aria-label="Visit website"
                        onMouseEnter={() => setWebsiteHovered(true)}
                        onMouseLeave={() => setWebsiteHovered(false)}
                      >
                        {selectedResort.websiteUrl}
                      </a>
                    </DetailField>
                  )}
                </div>

                {selectedResort.description && (
                  <div style={resortsStyles.detailDescriptionSection}>
                    <span style={resortsStyles.detailDescriptionLabel}>
                      Description
                    </span>
                    <p style={resortsStyles.detailDescriptionText}>
                      {selectedResort.description}
                    </p>
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
                userId={user.$id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div style={resortsStyles.detailField}>
      <span style={resortsStyles.detailFieldLabel}>{label}</span>
      <span style={resortsStyles.detailFieldValue}>
        {children ?? (value || '—')}
      </span>
    </div>
  )
}

interface ProposalFormProps {
  resort: Resort
  saving: boolean
  error: string
  onSubmit: (
    e: React.FormEvent,
    resort: Resort,
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

  return (
    <form
      onSubmit={(e) =>
        onSubmit(e, resort, startDate, endDate, description, resortName)
      }
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
        }}
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
          {saving ? 'Creating...' : 'Create Proposal'}
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
    fontSize: '30px',
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
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    margin: 0,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    flex: '1 1 240px',
    minWidth: '180px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
  },
  filterSelect: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: borders.card,
    background: colors.bgInput,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: '140px',
  },
  sliderLabel: {
    fontFamily: fonts.body,
    fontSize: '11px',
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  slider: {
    width: '140px',
    accentColor: colors.accent,
  },
  clearButton: {
    padding: '10px 16px',
    borderRadius: '7px',
    border: borders.card,
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '13px',
  },
  clearButtonDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  clearButtonEnabled: {
    cursor: 'pointer',
  },
  resultCount: {
    fontFamily: fonts.body,
    fontSize: '12px',
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
    fontSize: '11px',
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
    fontSize: '14px',
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
    background: 'rgba(0,0,0,0.6)',
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
  detailTitle: {
    fontFamily: fonts.display,
    fontSize: '24px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  detailCloseButton: {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
  },
  detailField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  detailFieldLabel: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  detailFieldValue: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textPrimary,
  },
  detailDescriptionSection: {
    marginBottom: '16px',
  },
  mapLink: {
    color: colors.accent,
    textDecoration: 'none',
    fontSize: '12px',
  },
  detailDescriptionLabel: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  detailDescriptionText: {
    fontFamily: fonts.body,
    fontSize: '14px',
    color: colors.textPrimary,
    lineHeight: '1.6',
    margin: '4px 0 0',
  },
  websiteLinkInline: {
    fontFamily: fonts.body,
    fontSize: '12px',
    color: colors.accent,
  },
  proposeButton: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
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
    fontSize: '14px',
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
    fontSize: '14px',
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
    fontSize: '18px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
  },
  proposalFormSubtitle: {
    fontFamily: fonts.body,
    fontSize: '13px',
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
    fontSize: '11px',
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
    fontSize: '14px',
    outline: 'none',
  },
  proposalFormTextarea: {
    padding: '10px 14px',
    borderRadius: '7px',
    border: borders.card,
    background: colors.bgCard,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
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

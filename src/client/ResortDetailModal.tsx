import { MapPin, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCountryFlagUrl } from '../shared/countries'
import type { ResortWithEmbedding, User } from '../shared/types.d'
import DateRangeField from './DateRangeField'
import DetailField from './DetailField'
import Paragraphs from './Paragraphs'
import PisteBreakdown from './PisteBreakdown'
import {
  borders,
  colors,
  detailStyles,
  fontSizes,
  fonts,
  formStyles,
  overlayStyles,
} from './theme'
import { toast } from './toast'
import {
  ensureUrlScheme,
  formatTransferTime,
  getErrorMessage,
  sanitizeUrl,
} from './utils'

const snowReliabilityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

interface ResortDetailModalProps {
  resort: ResortWithEmbedding
  tripId: string
  user: User
  onClose: () => void
  onNavigateToProposals?: () => void
  onAuthError?: (err: unknown) => void
}

export default function ResortDetailModal({
  resort,
  tripId,
  user,
  onClose,
  onNavigateToProposals: _onNavigateToProposals,
  onAuthError = () => {},
}: ResortDetailModalProps) {
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalSaving, setProposalSaving] = useState(false)
  const [hoveredWebsite, setHoveredWebsite] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmitProposal(
    e: React.FormEvent,
    startDate: string,
    endDate: string,
    description: string,
    customResortName?: string
  ) {
    e.preventDefault()
    if (!tripId) return
    setProposalSaving(true)
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
      toast(
        `Created proposal for ${customResortName || resort.resortName}`,
        'success'
      )
      onClose()
    } catch (err: unknown) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setProposalSaving(false)
    }
  }

  function handleCloseDetail() {
    onClose()
  }

  function handleProposeResort() {
    setShowProposalForm(true)
  }

  function handleCancelProposal() {
    setShowProposalForm(false)
  }

  const showFooter = !showProposalForm

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={overlayStyles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseDetail()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleCloseDetail()
      }}
    >
      <div
        role="document"
        style={overlayStyles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={overlayStyles.panelHeader}>
          <div>
            <h3 style={overlayStyles.panelTitle}>
              {resort.resortName || '\u2014'}
            </h3>
            {(resort.country || resort.region) && (
              <div style={resortDetailModalStyles.locationLine}>
                {(() => {
                  const flagUrl =
                    resort.country && getCountryFlagUrl(resort.country)
                  return flagUrl ? (
                    <img
                      src={flagUrl}
                      alt={resort.country}
                      style={resortDetailModalStyles.locationFlag}
                    />
                  ) : null
                })()}
                {resort.region ? `${resort.region}, ` : ''}
                {resort.country}
                {resort.latitude && resort.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${resort.latitude},${resort.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={resortDetailModalStyles.mapPinLink}
                    aria-label="Open in Google Maps"
                  >
                    <MapPin size={14} />
                  </a>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseDetail}
            style={overlayStyles.closeButton}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={overlayStyles.panelContent}>
          {!showProposalForm && (
            <>
              <div style={resortDetailModalStyles.detailGrid}>
                <DetailField
                  label="Altitude Range"
                  value={
                    resort.baseAltitude && resort.summitAltitude
                      ? `${resort.baseAltitude}m \u2013 ${resort.summitAltitude}m`
                      : ''
                  }
                />
                <DetailField
                  label="Piste"
                  value={resort.pisteKm ? `${resort.pisteKm} km` : ''}
                />
                <DetailField label="Piste Breakdown">
                  <PisteBreakdown
                    beginnerPct={resort.beginnerPct}
                    intermediatePct={resort.intermediatePct}
                    advancedPct={resort.advancedPct}
                  />
                </DetailField>
                <DetailField
                  label="Lifts"
                  value={resort.liftCount ? String(resort.liftCount) : ''}
                />
                <DetailField
                  label="Snow Reliability"
                  value={
                    snowReliabilityLabels[resort.snowReliability] ??
                    resort.snowReliability
                  }
                />
                <DetailField
                  label="Ski Season"
                  value={resort.skiSeasonMonths}
                />
                <DetailField
                  label="Nearest Airport"
                  value={resort.nearestAirport}
                />
                <DetailField
                  label="Transfer Time"
                  value={formatTransferTime(resort.transferTime)}
                />
                {resort.websites && resort.websites.length > 0 && (
                  <DetailField
                    label="Websites"
                    style={{ gridColumn: 'span 2' }}
                  >
                    <ul style={resortDetailModalStyles.websiteList}>
                      {resort.websites.map((url) => (
                        <li key={url}>
                          <a
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
                        </li>
                      ))}
                    </ul>
                  </DetailField>
                )}
              </div>

              {resort.linkedResortsDescription && (
                <div style={resortDetailModalStyles.detailDescriptionSection}>
                  <DetailField label="Linked Resorts">
                    <Paragraphs
                      text={resort.linkedResortsDescription}
                      style={detailStyles.descriptionText}
                    />
                  </DetailField>
                </div>
              )}

              {resort.description && (
                <div style={resortDetailModalStyles.detailDescriptionSection}>
                  <DetailField label="Description">
                    <Paragraphs
                      text={resort.description}
                      style={detailStyles.descriptionText}
                    />
                  </DetailField>
                </div>
              )}
            </>
          )}

          {showProposalForm && (
            <ProposalForm
              resort={resort}
              saving={proposalSaving}
              onSubmit={handleSubmitProposal}
              onCancel={handleCancelProposal}
              onAuthError={onAuthError}
              tripId={tripId}
              userId={user.id}
            />
          )}
        </div>

        {showFooter && (
          <div style={overlayStyles.panelFooter}>
            {!showProposalForm && (
              <button
                type="button"
                onClick={handleProposeResort}
                style={resortDetailModalStyles.proposeButton}
              >
                Propose this resort
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ProposalFormProps {
  resort: ResortWithEmbedding
  saving: boolean
  onSubmit: (
    e: React.FormEvent,
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
        onSubmit(e, startDate, endDate, description, resortName)
      }}
      style={resortDetailModalStyles.proposalForm}
    >
      <p style={resortDetailModalStyles.proposalFormSubtitle}>
        {resort.country}
        {resort.region ? `, ${resort.region}` : ''}
      </p>
      <div
        style={{
          ...resortDetailModalStyles.proposalFormField,
          marginTop: '16px',
        }}
      >
        <label
          htmlFor="proposal-resort-name"
          style={resortDetailModalStyles.proposalFormLabel}
        >
          Proposal name (e.g. the resort name)
        </label>
        <input
          id="proposal-resort-name"
          type="text"
          value={resortName}
          onChange={(e) => setResortName(e.target.value)}
          required
          style={resortDetailModalStyles.proposalFormInput}
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
      <div style={resortDetailModalStyles.proposalFormField}>
        <label
          htmlFor="proposal-description"
          style={resortDetailModalStyles.proposalFormLabel}
        >
          Description
        </label>
        <textarea
          id="proposal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={resortDetailModalStyles.proposalFormTextarea}
          placeholder="Describe the trip idea..."
          rows={12}
        />
      </div>
      <div style={resortDetailModalStyles.proposalFormActions}>
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

const resortDetailModalStyles = {
  locationLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: '2px',
  },
  locationFlag: {
    display: 'inline-block',
    width: '18px',
    height: '13px',
    verticalAlign: 'middle',
  },
  mapPinLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: colors.accent,
    textDecoration: 'none',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
    marginBottom: '16px',
  },
  websiteList: {
    listStyleType: 'disc' as const,
    paddingLeft: '20px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  detailDescriptionSection: {
    marginTop: '6px',
    marginBottom: '16px',
  },
  proposeButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
  },
  stayButton: {
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
  successContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '20px',
    padding: '24px 0',
  },
  proposalForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  proposalFormSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: '-12px 0 0',
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

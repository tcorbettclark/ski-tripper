import type { Models } from 'appwrite'
import { Check, Copy, Heart, Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getPreferences as _getPreferences,
  listPolls as _listPolls,
  listProposals as _listProposals,
  listTripParticipants as _listTripParticipants,
  listVotes as _listVotes,
  updateTrip as _updateTrip,
} from './backend'
import EditTripDescriptionForm from './EditTripDescriptionForm'
import {
  BlackSlopeIcon,
  BlueSlopeIcon,
  ChaletIcon,
  FiveStarHotelIcon,
  GuesthouseIcon,
  HotelIcon,
  OffPisteIcon,
  OnPisteIcon,
  RedSlopeIcon,
  SkiIcon,
  SnowboardIcon,
} from './Icons'
import NextActions from './NextActions'
import { borders, colors, fontSizes, fonts, formStyles, mix } from './theme'
import type {
  Participant,
  Poll,
  Preferences,
  Proposal,
  ResortWithEmbedding,
  Trip,
  Vote,
} from './types.d.ts'
import { parseJsonArray } from './utils'

interface OverviewProps {
  user: Models.User
  trip: Trip
  tripId: string
  resorts: ResortWithEmbedding[]
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: 'DRAFT' | 'SUBMITTED' | 'REJECTED'
  ) => void
  onTripUpdated?: (trip: Trip) => void
  onAuthError?: (err: unknown) => void
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  listProposals?: (
    tripId: string,
    userId: string
  ) => Promise<{ proposals: Proposal[] }>
  listPolls?: (tripId: string, userId: string) => Promise<{ polls: Poll[] }>
  listVotes?: (pollId: string, userId: string) => Promise<{ votes: Vote[] }>
  getCoordinatorParticipant?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
  updateTrip?: (
    tripId: string,
    data: Partial<Trip>,
    participantUserId: string
  ) => Promise<Trip>
  getPreferences?: (userId: string) => Promise<Preferences | null>
  preferencesUpdated?: { userId: string; preferences: Preferences } | null
  onOpenPreferences?: () => void
}

const noopAuthError = () => {}

export default function Overview({
  user,
  trip,
  tripId,
  resorts,
  onNavigateToTab,
  onTripUpdated,
  onAuthError = noopAuthError,
  listTripParticipants = _listTripParticipants,
  listProposals = _listProposals,
  listPolls = _listPolls,
  listVotes = _listVotes,
  getCoordinatorParticipant = _getCoordinatorParticipant,
  updateTrip = _updateTrip,
  getPreferences = _getPreferences,
  preferencesUpdated,
  onOpenPreferences,
}: OverviewProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [preferencesMap, setPreferencesMap] = useState<
    Record<string, Preferences | null>
  >({})
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(true)
  const [participantsError, setParticipantsError] = useState('')
  const [userVotedInActivePoll, setUserVotedInActivePoll] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeCopyError, setCodeCopyError] = useState('')
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [aspectPopup, setAspectPopup] = useState<{
    userId: string
    text: string
    x: number
    y: number
  } | null>(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    getCoordinatorParticipant(tripId)
      .then(({ participants }) => {
        if (!mountedRef.current) return
        setIsCoordinator(
          participants.length > 0 &&
            participants[0].participantUserId === user.$id
        )
      })
      .catch(() => {})
  }, [tripId, user.$id, getCoordinatorParticipant])

  useEffect(() => {
    if (!tripId) return

    setParticipantsLoading(true)
    setParticipantsError('')
    listTripParticipants(tripId)
      .then((result) => {
        if (!mountedRef.current) return
        setParticipants(result.participants)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        const msg = err instanceof Error ? err.message : String(err)
        setParticipantsError(msg)
        onAuthError(err)
      })
      .finally(() => {
        if (mountedRef.current) setParticipantsLoading(false)
      })
  }, [tripId, listTripParticipants, onAuthError])

  useEffect(() => {
    if (participants.length === 0) return
    Promise.all(
      participants.map((p) =>
        getPreferences(p.participantUserId).then(
          (prefs) => [p.participantUserId, prefs] as const
        )
      )
    )
      .then((results) => {
        if (!mountedRef.current) return
        const map: Record<string, Preferences | null> = {}
        for (const [userId, prefs] of results) {
          map[userId] = prefs
        }
        setPreferencesMap(map)
      })
      .catch(() => {})
  }, [participants, getPreferences])

  useEffect(() => {
    if (!preferencesUpdated) return
    setPreferencesMap((prev) => ({
      ...prev,
      [preferencesUpdated.userId]: preferencesUpdated.preferences,
    }))
  }, [preferencesUpdated])

  useEffect(() => {
    if (!tripId) return

    listProposals(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setProposals(result.proposals)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        onAuthError(err)
      })
  }, [tripId, user.$id, listProposals, onAuthError])

  useEffect(() => {
    if (!tripId) return

    listPolls(tripId, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setPolls(result.polls)
      })
      .catch((err) => {
        if (!mountedRef.current) return
        onAuthError(err)
      })
  }, [tripId, user.$id, listPolls, onAuthError])

  const activePoll = polls.find((p) => p.state === 'OPEN')
  const closedPollCount = polls.filter((p) => p.state === 'CLOSED').length

  useEffect(() => {
    if (!activePoll) {
      setUserVotedInActivePoll(false)
      return
    }
    listVotes(activePoll.$id, user.$id)
      .then((result) => {
        if (!mountedRef.current) return
        setUserVotedInActivePoll(result.votes.length > 0)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setUserVotedInActivePoll(false)
      })
  }, [activePoll, user.$id, listVotes])

  const draftCount = proposals.filter(
    (p) => p.state === 'DRAFT' && p.proposerUserId === user.$id
  ).length
  const submittedCount = proposals.filter((p) => p.state === 'SUBMITTED').length
  const approvedCount = proposals.filter((p) => p.state === 'APPROVED').length

  function renderPreferenceCell(
    prefs: Preferences | null | undefined,
    column: string,
    participantUserId?: string
  ) {
    if (!prefs) return <span style={overviewStyles.cellEmpty}>—</span>

    if (column === 'ski') {
      const ski = parseJsonArray(prefs.skiSnowboard)
      const tip = ski.length > 0 ? ski.join(', ') : 'Not set'
      return (
        <span title={tip} style={overviewStyles.iconRow}>
          <SkiIcon dim={!ski.includes('Ski')} />
          <SnowboardIcon dim={!ski.includes('Snowboard')} />
        </span>
      )
    }

    if (column === 'diff') {
      const diff = parseJsonArray(prefs.difficulty)
      const slopeOrder: Record<string, number> = { Black: 0, Red: 1, Blue: 2 }
      const slopeIcons: Record<string, typeof BlackSlopeIcon> = {
        Black: BlackSlopeIcon,
        Red: RedSlopeIcon,
        Blue: BlueSlopeIcon,
      }
      const tip =
        [...diff]
          .sort((a, b) => (slopeOrder[a] ?? 3) - (slopeOrder[b] ?? 3))
          .join('/') || 'Not set'
      const sorted = Object.keys(slopeOrder).sort(
        (a, b) => slopeOrder[a] - slopeOrder[b]
      )
      return (
        <span title={tip} style={overviewStyles.iconRow}>
          {sorted.map((d) => {
            const Icon = slopeIcons[d]
            return <Icon key={d} dim={!diff.includes(d)} />
          })}
        </span>
      )
    }

    if (column === 'piste') {
      const piste = parseJsonArray(prefs.piste)
      const tip = piste.length > 0 ? piste.join(', ') : 'Not set'
      return (
        <span title={tip} style={overviewStyles.iconRow}>
          <OnPisteIcon dim={!piste.includes('On-Piste')} />
          <OffPisteIcon dim={!piste.includes('Off-Piste')} />
        </span>
      )
    }

    if (column === 'accom') {
      const accom = parseJsonArray(prefs.accommodation)
      const tip = accom.length > 0 ? accom.join(', ') : 'Not set'
      return (
        <span title={tip} style={overviewStyles.iconRow}>
          <FiveStarHotelIcon
            dim={!accom.includes('5-star hotel with spa etc')}
          />
          <HotelIcon dim={!accom.includes('4-star or below hotel')} />
          <ChaletIcon dim={!accom.includes('Chalet')} />
          <GuesthouseIcon dim={!accom.includes('Pension/guesthouse')} />
        </span>
      )
    }

    if (column === 'time') {
      const timeSegments = [
        {
          key: 'slopes',
          label: 'Slopes',
          value: prefs.timeSlopes,
          color: colors.accent,
        },
        {
          key: 'eating',
          label: 'Eating',
          value: prefs.timeEating,
          color: colors.timeEating,
        },
        {
          key: 'apres',
          label: 'Après',
          value: prefs.timeApres,
          color: colors.timeApres,
        },
        {
          key: 'hotel',
          label: 'Hotel',
          value: prefs.timeHotel,
          color: colors.timeHotel,
        },
      ]
      if (!timeSegments.some((s) => s.value > 0))
        return <span style={overviewStyles.cellEmpty}>—</span>
      const tip = timeSegments
        .filter((s) => s.value > 0)
        .map((s) => `${s.label} ${s.value}%`)
        .join(' · ')
      return (
        <span title={tip}>
          <span style={overviewStyles.timeMeters}>
            {timeSegments.map((seg) => (
              <span
                key={seg.key}
                style={overviewStyles.timeMeter}
                title={`${seg.label} ${seg.value}%`}
              >
                {seg.label}
                <span style={overviewStyles.timeMeterTrack}>
                  <span
                    style={{
                      ...overviewStyles.timeMeterFill,
                      width: `${seg.value}%`,
                      background: seg.color,
                    }}
                  />
                </span>
              </span>
            ))}
          </span>
        </span>
      )
    }

    if (column === 'aspect') {
      if (!prefs.mostImportantAspect)
        return <span style={overviewStyles.cellEmpty}>—</span>
      const isOpen = aspectPopup?.userId === participantUserId
      return (
        <button
          type="button"
          data-aspect-toggle={participantUserId}
          onClick={(e) => {
            e.stopPropagation()
            if (!participantUserId) return
            if (isOpen) {
              setAspectPopup(null)
            } else {
              const rect = e.currentTarget.getBoundingClientRect()
              setAspectPopup({
                userId: participantUserId,
                text: prefs.mostImportantAspect,
                x: rect.right + 8,
                y: rect.top,
              })
            }
          }}
          style={{
            ...overviewStyles.aspectToggleButton,
            opacity: isOpen ? 1 : 0.7,
          }}
          title="Show description"
          aria-label="Show description"
          aria-expanded={isOpen}
        >
          <Heart size={14} />
        </button>
      )
    }

    return null
  }

  const prefColumns = [
    'ski',
    'diff',
    'piste',
    'accom',
    'time',
    'aspect',
  ] as const

  const colWidths: Record<string, string> = {
    name: '100px',
    ski: '48px',
    diff: '54px',
    piste: '48px',
    accom: '68px',
    time: '170px',
    aspect: '90px',
  }

  const sortedParticipants = [...participants]
    .map((p) => {
      if (p.participantUserId === user.$id) {
        return { ...p, participantUserName: user.name || user.email }
      }
      return p
    })
    .sort((a, b) => {
      if (a.role === 'coordinator' && b.role !== 'coordinator') return -1
      if (a.role !== 'coordinator' && b.role === 'coordinator') return 1
      return 0
    })

  function handleCopyCode() {
    if (!trip.code) return
    navigator.clipboard
      .writeText(trip.code)
      .then(() => {
        if (!mountedRef.current) return
        setCodeCopied(true)
        setCodeCopyError('')
        setTimeout(() => {
          if (mountedRef.current) setCodeCopied(false)
        }, 1500)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setCodeCopyError('Failed to copy')
      })
  }

  useEffect(() => {
    if (!aspectPopup) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-aspect-popup]')) return
      if (target.closest('[data-aspect-toggle]')) return
      if (!mountedRef.current) return
      setAspectPopup(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [aspectPopup])

  return (
    <div style={overviewStyles.container}>
      <div style={overviewStyles.toolbar}>
        <h2 style={overviewStyles.heading}>
          {trip.description || '—'}
          {isCoordinator && !editingDescription && (
            <button
              type="button"
              onClick={() => setEditingDescription(true)}
              style={overviewStyles.editButton}
              title="Edit description"
              aria-label="Edit description"
            >
              <Pencil size={16} />
            </button>
          )}
        </h2>
      </div>

      {editingDescription && (
        <div style={overviewStyles.card}>
          <EditTripDescriptionForm
            trip={trip}
            userId={user.$id}
            onUpdated={(updatedTrip) => {
              setEditingDescription(false)
              onTripUpdated?.(updatedTrip)
            }}
            onCancel={() => setEditingDescription(false)}
            updateTrip={updateTrip}
          />
        </div>
      )}

      <div style={overviewStyles.metaLine}>
        <span style={overviewStyles.hint}>
          Code to share with friends so they can join this trip:
        </span>
        <span style={overviewStyles.codeWithCopy}>
          <span style={overviewStyles.codeValue}>{trip.code}</span>
          <button
            type="button"
            onClick={handleCopyCode}
            style={overviewStyles.copyButton}
            title="Copy invite code"
            aria-label="Copy invite code"
          >
            {codeCopied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          {codeCopied && (
            <span style={overviewStyles.copyFeedback}>Copied!</span>
          )}
          {codeCopyError && (
            <span style={overviewStyles.copyFeedback}>{codeCopyError}</span>
          )}
        </span>
      </div>
      {participants.filter((p) => p.role === 'coordinator').length > 0 && (
        <div style={overviewStyles.metaLine}>
          <span style={overviewStyles.coordinatorLabel}>
            Trip coordinator(s) drive the process:
          </span>
          <span style={overviewStyles.coordinatorNames}>
            {participants
              .filter((p) => p.role === 'coordinator')
              .map((c) => c.participantUserName)
              .join(', ')}
          </span>
        </div>
      )}

      <section style={overviewStyles.section}>
        <h3 style={overviewStyles.sectionHeading}>Our Preferences</h3>
        {participantsLoading && (
          <p style={overviewStyles.loading}>Loading...</p>
        )}
        {participantsError && (
          <p style={formStyles.error}>{participantsError}</p>
        )}
        {!participantsLoading && !participantsError && (
          <div style={overviewStyles.card}>
            {participants.length === 0 ? (
              <p style={overviewStyles.empty}>No participants</p>
            ) : (
              <div style={overviewStyles.participantGrid}>
                <style>{`.participant-name-cell { background: var(--color-bgCard); transition: background 0.15s; } .participant-grid-row-clickable { transition: background 0.15s; } .participant-grid-row-clickable:hover { background: color-mix(in srgb, var(--color-accent) 25%, transparent); cursor: pointer; } .participant-grid-row-clickable:hover .participant-name-cell { background: color-mix(in srgb, var(--color-accent) 25%, var(--color-bgCard)); }`}</style>
                {sortedParticipants.map((p) => {
                  const prefs = preferencesMap[p.participantUserId]
                  const isCurrentUser =
                    p.participantUserId === user.$id && !!onOpenPreferences
                  return (
                    <div key={p.$id}>
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: row is interactive only for the current user, role and keyboard handler are set conditionally */}
                      <div
                        className={
                          isCurrentUser
                            ? 'participant-grid-row-clickable'
                            : undefined
                        }
                        style={overviewStyles.gridRow}
                        onClick={isCurrentUser ? onOpenPreferences : undefined}
                        onKeyDown={
                          isCurrentUser
                            ? (e) => {
                                if (e.key === 'Enter') onOpenPreferences()
                              }
                            : undefined
                        }
                        tabIndex={isCurrentUser ? 0 : undefined}
                        role={isCurrentUser ? 'button' : undefined}
                      >
                        <span
                          className="participant-name-cell"
                          style={{
                            ...(isCurrentUser
                              ? overviewStyles.nameCellClickable
                              : overviewStyles.nameCell),
                            flex: '0 0 auto',
                            minWidth: colWidths.name,
                          }}
                        >
                          <span style={overviewStyles.participantName}>
                            {p.participantUserName}
                          </span>
                        </span>
                        {prefColumns.map((col) => (
                          <span
                            key={col}
                            style={{
                              ...(isCurrentUser
                                ? overviewStyles.gridCellClickable
                                : overviewStyles.gridCell),
                              flex: '0 0 auto',
                              minWidth: colWidths[col],
                            }}
                          >
                            {renderPreferenceCell(
                              prefs,
                              col,
                              p.participantUserId
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <NextActions
        resortCount={resorts.length}
        draftCount={draftCount}
        submittedCount={submittedCount}
        approvedCount={approvedCount}
        closedPollCount={closedPollCount}
        activePoll={activePoll}
        userVotedInActivePoll={userVotedInActivePoll}
        isCoordinator={isCoordinator}
        onNavigateToTab={onNavigateToTab}
      />

      {aspectPopup && (
        <div
          data-aspect-popup
          style={{
            ...overviewStyles.aspectPopup,
            top: aspectPopup.y,
            left: Math.min(aspectPopup.x, window.innerWidth - 260),
          }}
        >
          <div style={overviewStyles.aspectPopupHeader}>
            <Heart size={12} style={overviewStyles.aspectPopupIcon} />
            <button
              type="button"
              onClick={() => setAspectPopup(null)}
              style={overviewStyles.aspectPopupClose}
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
          <span style={overviewStyles.aspectPopupText}>{aspectPopup.text}</span>
        </div>
      )}
    </div>
  )
}

const overviewStyles = {
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
  section: {
    marginTop: '32px',
    marginBottom: '32px',
  },
  sectionHeading: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    margin: '0 0 12px',
  },
  card: {
    background: colors.bgCard,
    border: borders.card,
    borderRadius: '10px',
    overflow: 'hidden' as const,
    minWidth: 0,
  },

  codeValue: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    color: colors.accent,
    letterSpacing: '0.04em',
  },
  codeWithCopy: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  metaLine: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'baseline',
    gap: '6px',
    marginBottom: '12px',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  coordinatorLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  coordinatorNames: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  copyButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    padding: '0 2px',
    lineHeight: 1,
    opacity: 0.7,
  },
  copyFeedback: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginLeft: '4px',
  },
  editButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    padding: '0 2px',
    marginLeft: '6px',
    lineHeight: 1,
    opacity: 0.7,
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    margin: 0,
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    margin: 0,
  },
  participantGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
    overflowX: 'auto' as const,
  },
  gridRow: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: '0 20px',
    padding: '10px 16px',
    minWidth: '560px',
  },

  nameCellClickable: {
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    paddingRight: '8px',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'left' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    position: 'sticky' as const,
    left: 0,
    zIndex: 1,
  },
  gridCellClickable: {
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingRight: '8px',
    position: 'sticky' as const,
    left: 0,
    zIndex: 1,
  },
  gridCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: mix('--color-textSecondary', 0.2),
  },
  iconRow: {
    display: 'inline-flex',
    gap: '2px',
    alignItems: 'center',
  },
  aspectToggleButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.accent,
    padding: '2px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aspectPopup: {
    position: 'fixed' as const,
    zIndex: 1000,
    background: colors.bgCard,
    border: borders.accent,
    borderRadius: '8px',
    padding: '10px 12px',
    maxWidth: '240px',
    minWidth: '160px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
  },
  aspectPopupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  aspectPopupIcon: {
    color: colors.accent,
  },
  aspectPopupClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.textSecondary,
    padding: '2px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aspectPopupText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textData,
    lineHeight: '1.5',
    whiteSpace: 'pre-line' as const,
    wordBreak: 'break-word' as const,
  },
  participantName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  timeMeters: {
    display: 'inline-flex',
    gap: '6px',
  },
  timeMeter: {
    display: 'inline-flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  timeMeterTrack: {
    width: '36px',
    height: '3px',
    borderRadius: '2px',
    background: mix('--color-textSecondary', 0.1),
    overflow: 'hidden',
  },
  timeMeterFill: {
    display: 'block',
    height: '100%',
    borderRadius: '2px',
  },
} as const

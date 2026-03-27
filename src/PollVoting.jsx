import { useState, useRef, useLayoutEffect } from 'react'
import { upsertVote as _upsertVote } from './backend'
import { colors, fonts, borders } from './theme'

export default function PollVoting ({
  poll,
  proposals,
  myVote,
  userId,
  onVoteSaved,
  upsertVote = _upsertVote
}) {
  const proposalMap = Object.fromEntries(proposals.map((p) => [p.$id, p]))

  const [allocations, setAllocations] = useState(() => {
    const init = {}
    poll.proposalIds.forEach((id) => { init[id] = 0 })
    if (myVote) {
      myVote.proposalIds.forEach((id, i) => { init[id] = myVote.tokenCounts[i] || 0 })
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedToken, setSelectedToken] = useState(null) // { source: 'pile' | proposalId }
  const suppressClickRef = useRef(false)
  const dragRef = useRef(null) // { source, startX, startY, moved }
  const ghostRef = useRef(null)
  const remainingRef = useRef(null)

  const maxTokens = poll.proposalIds.length
  const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0)
  const remaining = maxTokens - totalUsed
  remainingRef.current = remaining

  const [flyingTokens, setFlyingTokens] = useState([])
  const [flightTrigger, setFlightTrigger] = useState(0)
  const flyIdRef = useRef(0)
  const pendingFlightRef = useRef(null) // { fromRect, target: proposalId | 'pile' }
  const pileZoneRef = useRef(null)
  const zoneRefs = useRef({}) // { [proposalId]: DOM element }

  useLayoutEffect(() => {
    function onPointerMove (e) {
      if (!dragRef.current) return
      const { startX, startY } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (!dragRef.current.moved && Math.sqrt(dx * dx + dy * dy) > 8) {
        dragRef.current.moved = true
        const ghost = document.createElement('div')
        ghost.textContent = '🪙'
        Object.assign(ghost.style, {
          position: 'fixed',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(59,189,232,0.4), rgba(59,189,232,0.15))',
          border: '2px solid rgba(59,189,232,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          lineHeight: '1',
          pointerEvents: 'none',
          zIndex: '9999',
          transform: 'translate(-50%, -50%) scale(1.2)',
          transition: 'transform 0.1s'
        })
        document.body.appendChild(ghost)
        ghostRef.current = ghost
      }

      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX}px`
        ghostRef.current.style.top = `${e.clientY}px`
      }
    }

    function onPointerUp (e) {
      if (!dragRef.current) return
      const { source, moved } = dragRef.current
      dragRef.current = null

      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current)
        ghostRef.current = null
      }

      if (!moved) return // tap — let the click event fire

      suppressClickRef.current = true

      const el = document.elementFromPoint(e.clientX, e.clientY)
      const zoneEl = el?.closest('[data-zone]')
      const target = zoneEl?.dataset?.zone

      if (!target || target === source) return

      if (target === 'pile') {
        if (source !== 'pile') {
          setAllocations((prev) => ({ ...prev, [source]: prev[source] - 1 }))
          setSaved(false)
        }
      } else if (source === 'pile') {
        if (remainingRef.current > 0) {
          setAllocations((prev) => ({ ...prev, [target]: prev[target] + 1 }))
          setSaved(false)
        }
      } else {
        setAllocations((prev) => ({
          ...prev,
          [source]: prev[source] - 1,
          [target]: prev[target] + 1
        }))
        setSaved(false)
      }
    }

    function onPointerCancel () {
      if (!dragRef.current) return
      dragRef.current = null
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current)
        ghostRef.current = null
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current)
        ghostRef.current = null
      }
    }
  }, []) // stable — uses refs for current state values

  useLayoutEffect(() => {
    const pending = pendingFlightRef.current
    if (!pending?.fromRect) return
    pendingFlightRef.current = null

    let toRect
    if (pending.target === 'pile') {
      const pileTokens = pileZoneRef.current?.querySelectorAll('[data-testid="pile-token"]')
      toRect = pileTokens?.[0]?.getBoundingClientRect() ??
        pileZoneRef.current?.getBoundingClientRect()
    } else {
      const zoneEl = zoneRefs.current[pending.target]
      const placed = zoneEl?.querySelectorAll('[data-testid="placed-token"]')
      toRect = placed?.[placed.length - 1]?.getBoundingClientRect() ??
        zoneEl?.getBoundingClientRect()
    }

    if (!toRect) return

    const id = ++flyIdRef.current
    setFlyingTokens((prev) => [
      ...prev,
      {
        id,
        from: {
          cx: pending.fromRect.left + pending.fromRect.width / 2,
          cy: pending.fromRect.top + pending.fromRect.height / 2,
          size: pending.fromRect.width
        },
        to: {
          cx: toRect.left + toRect.width / 2,
          cy: toRect.top + toRect.height / 2,
          size: toRect.width
        }
      }
    ])
  }, [flightTrigger])

  function startDrag (e, source) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragRef.current = {
      source,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    }
  }

  function capturePileTokenRect () {
    const tokens = pileZoneRef.current?.querySelectorAll('[data-testid="pile-token"]')
    return tokens?.[0]?.getBoundingClientRect() ?? null
  }

  function captureZoneTokenRect (proposalId) {
    const tokens = zoneRefs.current[proposalId]?.querySelectorAll('[data-testid="placed-token"]')
    return tokens?.[0]?.getBoundingClientRect() ?? null
  }

  function handlePileZoneClick () {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    setSaved(false)
    if (selectedToken) {
      if (selectedToken.source === 'pile') {
        setSelectedToken(null)
      } else {
        const fromRect = captureZoneTokenRect(selectedToken.source)
        pendingFlightRef.current = { fromRect, target: 'pile' }
        setAllocations((prev) => ({
          ...prev,
          [selectedToken.source]: prev[selectedToken.source] - 1
        }))
        setFlightTrigger((v) => v + 1)
        setSelectedToken(null)
      }
    } else {
      if (remaining > 0) setSelectedToken({ source: 'pile' })
    }
  }

  function handleProposalClick (proposalId) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    setSaved(false)
    if (selectedToken) {
      const source = selectedToken.source
      if (source === proposalId) {
        setSelectedToken(null)
      } else {
        const fromRect = source === 'pile' ? capturePileTokenRect() : captureZoneTokenRect(source)
        pendingFlightRef.current = { fromRect, target: proposalId }
        if (source === 'pile') {
          setAllocations((prev) => ({ ...prev, [proposalId]: prev[proposalId] + 1 }))
        } else {
          setAllocations((prev) => ({
            ...prev,
            [source]: prev[source] - 1,
            [proposalId]: prev[proposalId] + 1
          }))
        }
        setFlightTrigger((v) => v + 1)
        setSelectedToken(null)
      }
    } else {
      if (allocations[proposalId] > 0) setSelectedToken({ source: proposalId })
    }
  }

  async function handleSave () {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    const nonZeroIds = poll.proposalIds.filter((id) => allocations[id] > 0)
    try {
      const result = await upsertVote(
        poll.$id,
        poll.tripId,
        userId,
        nonZeroIds,
        nonZeroIds.map((id) => allocations[id])
      )
      setSaved(true)
      onVoteSaved(result)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      {flyingTokens.map((ft) => (
        <FlyingToken
          key={ft.id}
          from={ft.from}
          to={ft.to}
          onDone={() => setFlyingTokens((prev) => prev.filter((f) => f.id !== ft.id))}
        />
      ))}
      <div style={styles.sectionLabel}>
        Your tokens · {remaining} remaining
      </div>

      {/* Token pile */}
      <div
        ref={pileZoneRef}
        data-testid='pile-zone'
        aria-selected={selectedToken?.source === 'pile' ? 'true' : 'false'}
        style={{
          ...styles.pileZone,
          ...(selectedToken && selectedToken.source !== 'pile' ? styles.pileZoneHighlight : {})
        }}
        data-zone='pile'
        onClick={handlePileZoneClick}
      >
        {remaining === 0
          ? <span style={styles.pileEmpty}>All tokens placed</span>
          : Array.from({ length: remaining }, (_, i) => (
            <div
              key={i}
              data-testid='pile-token'
              style={{
                ...styles.token,
                ...(selectedToken?.source === 'pile' && i === 0 ? styles.tokenSelected : {})
              }}
              onPointerDown={(e) => startDrag(e, 'pile')}
            >
              🪙
            </div>
          ))}
      </div>

      {/* Proposals */}
      <div style={styles.proposals}>
        {poll.proposalIds.map((proposalId) => {
          const count = allocations[proposalId]
          const proposal = proposalMap[proposalId]
          return (
            <div
              key={proposalId}
              ref={(el) => { zoneRefs.current[proposalId] = el }}
              data-testid={`zone-${proposalId}`}
              data-zone={proposalId}
              style={{
                ...styles.proposalCard,
                ...(selectedToken && selectedToken.source !== proposalId ? styles.proposalCardHighlight : {}),
                ...(selectedToken?.source === proposalId ? styles.proposalCardSelected : {})
              }}
              onClick={() => handleProposalClick(proposalId)}
            >
              <div style={styles.proposalHeader}>
                <span style={styles.proposalName}>
                  {proposal?.resortName || proposalId}
                </span>
                <span
                  data-testid={`count-${proposalId}`}
                  style={count > 0 ? styles.tokenCount : styles.tokenCountZero}
                >
                  {count}
                </span>
              </div>
              <div style={styles.dropZone}>
                {count > 0
                  ? Array.from({ length: count }, (_, i) => (
                    <div
                      key={i}
                      data-testid='placed-token'
                      style={{
                        ...styles.tokenSmall,
                        ...(selectedToken?.source === proposalId && i === 0 ? styles.tokenSmallSelected : {})
                      }}
                      onPointerDown={(e) => { e.stopPropagation(); startDrag(e, proposalId) }}
                    >
                      🪙
                    </div>
                  ))
                  : <span style={styles.dropZoneHint}>drop here</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.remaining}>{maxTokens} tokens · {totalUsed} placed</span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? 'Saving…' : 'Save Vote'}
        </button>
      </div>
      {saved && <p style={styles.savedText}>Vote saved</p>}
      {saveError && <p style={styles.errorText}>{saveError}</p>}
    </div>
  )
}

const styles = {
  container: { fontFamily: fonts.body },
  sectionLabel: {
    fontSize: '11px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '8px'
  },
  pileZone: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px 14px',
    background: 'rgba(59,189,232,0.04)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'rgba(59,189,232,0.25)',
    borderRadius: '10px',
    minHeight: '58px',
    alignItems: 'center',
    marginBottom: '16px',
    cursor: 'pointer'
  },
  pileZoneHighlight: {
    background: 'rgba(59,189,232,0.08)',
    borderColor: 'rgba(59,189,232,0.45)'
  },
  pileEmpty: {
    fontSize: '12px',
    color: 'rgba(106,148,174,0.5)'
  },
  token: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(59,189,232,0.3), rgba(59,189,232,0.1))',
    border: '2px solid rgba(59,189,232,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none'
  },
  tokenSelected: {
    borderColor: colors.accent,
    background: 'radial-gradient(circle at 35% 35%, rgba(59,189,232,0.5), rgba(59,189,232,0.2))',
    boxShadow: '0 0 0 3px rgba(59,189,232,0.3)',
    transform: 'scale(1.12)'
  },
  tokenSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(59,189,232,0.25), rgba(59,189,232,0.08))',
    border: '1.5px solid rgba(59,189,232,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none'
  },
  tokenSmallSelected: {
    borderColor: colors.accent,
    boxShadow: '0 0 0 2px rgba(59,189,232,0.3)'
  },
  proposals: { display: 'flex', flexDirection: 'column', gap: '10px' },
  proposalCard: {
    padding: '12px 14px',
    background: colors.bgCard,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(100,190,230,0.12)',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  proposalCardHighlight: {
    borderColor: 'rgba(59,189,232,0.45)',
    background: 'rgba(59,189,232,0.05)'
  },
  proposalCardSelected: {
    borderColor: 'rgba(59,189,232,0.3)'
  },
  proposalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  proposalName: { fontSize: '14px', color: colors.textData },
  tokenCount: { fontSize: '13px', color: colors.accent, fontWeight: '600' },
  tokenCountZero: {
    fontSize: '13px',
    color: 'rgba(106,148,174,0.35)',
    fontWeight: '600'
  },
  dropZone: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    minHeight: '36px',
    alignItems: 'center'
  },
  dropZoneHint: { fontSize: '11px', color: 'rgba(106,148,174,0.3)' },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '14px',
    borderTop: borders.subtle
  },
  remaining: { fontSize: '12px', color: colors.textSecondary },
  saveButton: {
    padding: '7px 20px',
    borderRadius: '6px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  savedText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '8px 0 0'
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '12px',
    margin: '8px 0 0'
  }
}

function FlyingToken ({ from, to, onDone }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    // Invert: snap back to start with no transition
    ref.current.style.transition = 'none'
    ref.current.style.transform = 'none'

    // Play: next two frames ensure the browser has painted the inverted position
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!ref.current) return
        const dx = to.cx - from.cx
        const dy = to.cy - from.cy
        const scale = to.size / from.size
        ref.current.style.transition = 'transform 280ms ease-out'
        ref.current.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
      })
    })
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: from.cx - from.size / 2,
        top: from.cy - from.size / 2,
        width: from.size,
        height: from.size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, rgba(59,189,232,0.3), rgba(59,189,232,0.1))',
        border: '2px solid rgba(59,189,232,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${from.size * 0.47}px`,
        pointerEvents: 'none',
        zIndex: 9999
      }}
      onTransitionEnd={onDone}
    >
      🪙
    </div>
  )
}

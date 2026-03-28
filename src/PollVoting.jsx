import { useState } from 'react'
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
    poll.proposalIds.forEach((id) => {
      init[id] = 0
    })
    if (myVote) {
      myVote.proposalIds.forEach((id, i) => {
        init[id] = myVote.tokenCounts[i] || 0
      })
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const maxTokens = poll.proposalIds.length
  const totalUsed = Object.values(allocations).reduce((a, b) => a + b, 0)
  const remaining = maxTokens - totalUsed

  const savedAllocations = {}
  if (myVote) {
    myVote.proposalIds.forEach((id, i) => {
      savedAllocations[id] = myVote.tokenCounts[i] || 0
    })
  }
  const isUnchanged = myVote && poll.proposalIds.every(
    (id) => allocations[id] === (savedAllocations[id] || 0)
  )

  function handleAdd (proposalId) {
    setSaved(false)
    setAllocations((prev) => ({ ...prev, [proposalId]: prev[proposalId] + 1 }))
  }

  function handleRemove (proposalId) {
    setSaved(false)
    setAllocations((prev) => ({ ...prev, [proposalId]: prev[proposalId] - 1 }))
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
      <div style={styles.proposals}>
        {poll.proposalIds.map((proposalId) => {
          const count = allocations[proposalId]
          const proposal = proposalMap[proposalId]
          const name = proposal?.resortName || proposalId
          return (
            <div key={proposalId} style={styles.proposalCard}>
              <span style={styles.proposalName}>{name}</span>
              <div style={styles.stepper}>
                <button
                  aria-label={`Remove vote from ${name}`}
                  onClick={() => handleRemove(proposalId)}
                  disabled={count === 0}
                  style={{
                    ...styles.stepperButton,
                    ...(count === 0 ? styles.stepperButtonDisabled : {})
                  }}
                >
                  −
                </button>
                <span
                  data-testid={`count-${proposalId}`}
                  style={count > 0 ? styles.count : styles.countZero}
                >
                  {count}
                </span>
                <button
                  aria-label={`Add vote to ${name}`}
                  onClick={() => handleAdd(proposalId)}
                  disabled={remaining === 0}
                  style={{
                    ...styles.stepperButton,
                    ...(remaining === 0 ? styles.stepperButtonDisabled : {})
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={styles.footer}>
        <span style={styles.footerText}>
          {totalUsed} of {maxTokens} votes placed
        </span>
        <button
          onClick={handleSave}
          disabled={saving || isUnchanged}
          style={{
            ...styles.saveButton,
            ...(isUnchanged ? styles.saveButtonDisabled : {})
          }}
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
  proposals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px'
  },
  proposalCard: {
    padding: '12px 14px',
    background: colors.bgCard,
    border: '1px solid rgba(100,190,230,0.12)',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  proposalName: { fontSize: '14px', color: colors.textData },
  stepper: { display: 'flex', alignItems: 'center', gap: '10px' },
  stepperButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1.5px solid rgba(59,189,232,0.5)',
    background: 'rgba(59,189,232,0.08)',
    color: colors.accent,
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    fontFamily: fonts.body
  },
  stepperButtonDisabled: {
    opacity: 0.3,
    cursor: 'default'
  },
  count: {
    fontSize: '14px',
    color: colors.accent,
    fontWeight: '600',
    minWidth: '16px',
    textAlign: 'center'
  },
  countZero: {
    fontSize: '14px',
    color: 'rgba(106,148,174,0.4)',
    fontWeight: '600',
    minWidth: '16px',
    textAlign: 'center'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '14px',
    borderTop: borders.subtle
  },
  footerText: { fontSize: '12px', color: colors.textSecondary },
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
  saveButtonDisabled: {
    opacity: 0.4,
    cursor: 'default'
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

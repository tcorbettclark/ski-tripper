import '../src/index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import ActionGuide from '../src/ActionGuide'
import { colors, fontSizes, fonts } from '../src/theme'
import type { Poll } from '../src/types.d'

const noop = () => {}

function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    $id: 'poll-1',
    $createdAt: '2026-01-01T00:00:00Z',
    $updatedAt: '2026-01-01T00:00:00Z',
    pollCreatorUserId: 'user-1',
    pollCreatorUserName: 'Alice',
    state: 'OPEN',
    tripId: 'trip-1',
    proposalIds: ['prop-1', 'prop-2'],
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-06-15T00:00:00Z',
    outcome: '',
    ...overrides,
  }
}

const scenarios = [
  {
    label: 'All zeroes (all pending)',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Resorts only (1 resort)',
    props: {
      resortCount: 1,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Resorts only (3 resorts)',
    props: {
      resortCount: 3,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Drafts only (1 draft, 1 mine)',
    props: {
      resortCount: 0,
      draftCount: 1,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Drafts only (3 drafts, 2 mine)',
    props: {
      resortCount: 0,
      draftCount: 3,
      myDrafts: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
      ],
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Drafts only (other users drafts, none mine)',
    props: {
      resortCount: 0,
      draftCount: 3,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Submitted only (2 submitted)',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
      ],
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Active poll — user has NOT voted',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: makePoll(),
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Active poll — user HAS voted',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: makePoll(),
      userVotedInActivePoll: true,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Coordinator with submitted, no poll (shows "Create poll")',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
      ],
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: true,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Non-coordinator with submitted (poll stays pending)',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
      ],
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Closed polls (2 past polls, return edge)',
    props: {
      resortCount: 0,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 2,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Mixed: resorts + drafts',
    props: {
      resortCount: 2,
      draftCount: 2,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
      ],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Mixed: resorts + drafts + submitted',
    props: {
      resortCount: 2,
      draftCount: 3,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
        { proposalId: 's3', resortName: 'Courchevel' },
        { proposalId: 's4', resortName: 'Meribel' },
      ],
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Mixed: drafts + submitted (no resorts)',
    props: {
      resortCount: 0,
      draftCount: 2,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
        { proposalId: 's3', resortName: 'Courchevel' },
      ],
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
      ],
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Full: everything active/present (no poll)',
    props: {
      resortCount: 5,
      draftCount: 3,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
        { proposalId: 's3', resortName: 'Courchevel' },
        { proposalId: 's4', resortName: 'Meribel' },
      ],
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 3,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Full: everything + active poll (unvoted)',
    props: {
      resortCount: 5,
      draftCount: 3,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
        { proposalId: 's3', resortName: 'Courchevel' },
        { proposalId: 's4', resortName: 'Meribel' },
      ],
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 3,
      activePoll: makePoll(),
      userVotedInActivePoll: false,
      isCoordinator: true,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Full: everything + active poll (voted) + coordinator',
    props: {
      resortCount: 5,
      draftCount: 3,
      myDrafts: [{ proposalId: 'p1', resortName: 'Chamonix' }],
      submittedProposals: [
        { proposalId: 's1', resortName: 'Zermatt' },
        { proposalId: 's2', resortName: 'St Anton' },
        { proposalId: 's3', resortName: 'Courchevel' },
        { proposalId: 's4', resortName: 'Meribel' },
      ],
      draftsForDiscussion: [
        { proposalId: 'p1', resortName: 'Chamonix' },
        { proposalId: 'p2', resortName: 'Val Thorens' },
        { proposalId: 'p3', resortName: 'Zermatt' },
      ],
      closedPollCount: 3,
      activePoll: makePoll(),
      userVotedInActivePoll: true,
      isCoordinator: true,
      onNavigateToTab: noop,
    },
  },
  {
    label: 'Single resort, no other data',
    props: {
      resortCount: 1,
      draftCount: 0,
      myDrafts: [] as Array<{ proposalId: string; resortName: string }>,
      submittedProposals: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      draftsForDiscussion: [] as Array<{
        proposalId: string
        resortName: string
      }>,
      closedPollCount: 0,
      activePoll: undefined,
      userVotedInActivePoll: false,
      isCoordinator: false,
      onNavigateToTab: noop,
    },
  },
]

const gridStyles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '32px 24px',
    background: 'var(--color-bgPrimary)',
    minHeight: '100vh',
  } as const,
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
    fontWeight: '600' as const,
    color: colors.textPrimary,
    margin: '0 0 8px',
  } as const,
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    margin: '0 0 48px',
  } as const,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(580px, 1fr))',
    gap: '48px',
  } as const,
  card: {
    background: 'var(--color-bgCard)',
    borderRadius: '12px',
    padding: '24px',
    border:
      '1px solid color-mix(in srgb, var(--color-accent) 14%, transparent)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  cardLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
    color: colors.accent,
    marginBottom: '8px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  } as const,
  cardProps: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: '16px',
    lineHeight: '1.6',
  } as const,
}

function App() {
  return (
    <div style={gridStyles.container}>
      <h1 style={gridStyles.title}>ActionGuide Playground</h1>
      <p style={gridStyles.subtitle}>
        {scenarios.length} scenarios showing different state combinations
      </p>
      <div style={gridStyles.grid}>
        {scenarios.map((scenario) => (
          <div key={scenario.label} style={gridStyles.card}>
            <div style={gridStyles.cardLabel}>{scenario.label}</div>
            <div style={gridStyles.cardProps}>
              resorts={scenario.props.resortCount} · drafts=
              {scenario.props.draftCount} · myDrafts=
              {scenario.props.myDrafts.length} · submitted=
              {scenario.props.submittedProposals.length} · closedPolls=
              {scenario.props.closedPollCount} · hasPoll=
              {scenario.props.activePoll ? 'yes' : 'no'} · voted=
              {String(scenario.props.userVotedInActivePoll)} · coordinator=
              {String(scenario.props.isCoordinator)}
            </div>
            <ActionGuide {...scenario.props} />
          </div>
        ))}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

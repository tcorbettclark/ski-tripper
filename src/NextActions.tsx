import {
  ArrowRight,
  BarChart3,
  CheckCircle,
  MessageSquare,
  Mountain,
  Send,
  Vote,
} from 'lucide-react'
import type { StatusFilter } from './ProposalsGrid'
import { borders, colors, fonts, mix } from './theme'
import type { Poll } from './types.d.ts'
import { formatDate } from './utils'

interface Action {
  label: string
  tab: 'resorts' | 'proposals' | 'poll'
  statusFilter?: StatusFilter
  icon: React.ReactNode
}

interface NextActionsProps {
  resortCount: number
  draftCount: number
  submittedCount: number
  approvedCount: number
  closedPollCount: number
  activePoll: Poll | undefined
  userVotedInActivePoll: boolean
  isCoordinator: boolean
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: StatusFilter
  ) => void
}

function buildActions(props: NextActionsProps): Action[] {
  const actions: Action[] = []

  actions.push({
    label: `Browse ${props.resortCount} resort${props.resortCount !== 1 ? 's' : ''} to make a proposal`,
    tab: 'resorts',
    icon: <Mountain size={16} />,
  })

  if (props.draftCount > 0 && !props.activePoll) {
    actions.push({
      label: `Submit ${props.draftCount} draft proposal${props.draftCount !== 1 ? 's' : ''} for voting`,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      icon: <Send size={16} />,
    })
  }

  if (props.submittedCount > 0 && !props.activePoll) {
    actions.push({
      label: `Comment on ${props.submittedCount} submitted proposal${props.submittedCount !== 1 ? 's' : ''}`,
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      icon: <MessageSquare size={16} />,
    })
  }

  if (props.submittedCount > 0 && !props.activePoll && props.isCoordinator) {
    actions.push({
      label: `Create a poll from ${props.submittedCount} proposal${props.submittedCount !== 1 ? 's' : ''}`,
      tab: 'poll',
      icon: <BarChart3 size={16} />,
    })
  }

  if (props.activePoll && !props.userVotedInActivePoll) {
    actions.push({
      label: `Vote in the active poll (ends ${formatDate(props.activePoll.endDate)})`,
      tab: 'poll',
      icon: <Vote size={16} />,
    })
  }

  if (props.activePoll && props.userVotedInActivePoll) {
    actions.push({
      label: `View active poll (ends ${formatDate(props.activePoll.endDate)})`,
      tab: 'poll',
      icon: <BarChart3 size={16} />,
    })
  }

  if (props.approvedCount > 0) {
    actions.push({
      label: `View ${props.approvedCount} approved proposal${props.approvedCount !== 1 ? 's' : ''}`,
      tab: 'proposals',
      icon: <CheckCircle size={16} />,
    })
  }

  if (props.closedPollCount > 0) {
    actions.push({
      label: `Review ${props.closedPollCount} closed poll${props.closedPollCount !== 1 ? 's' : ''}`,
      tab: 'poll',
      icon: <BarChart3 size={16} />,
    })
  }

  return actions
}

export default function NextActions(props: NextActionsProps) {
  const actions = buildActions(props)

  return (
    <section style={nextActionsStyles.container}>
      <div style={nextActionsStyles.header}>
        <span style={nextActionsStyles.headerIcon}>
          <ArrowRight size={14} />
        </span>
        <h3 style={nextActionsStyles.heading}>Next Steps</h3>
      </div>
      <div style={nextActionsStyles.grid}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() =>
              props.onNavigateToTab(action.tab, action.statusFilter)
            }
            style={nextActionsStyles.card}
          >
            <span style={nextActionsStyles.iconWrap}>{action.icon}</span>
            <span style={nextActionsStyles.label}>{action.label}</span>
            <ArrowRight size={14} style={nextActionsStyles.arrow} />
          </button>
        ))}
      </div>
    </section>
  )
}

const nextActionsStyles = {
  container: {
    marginTop: '48px',
    marginBottom: '32px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    background: mix('--color-accent', 0.12),
    color: colors.accent,
  },
  heading: {
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '10px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: borders.card,
    background: `linear-gradient(135deg, ${mix('--color-accent', 0.15)} 0%, ${mix('--color-accent', 0.05)} 100%)`,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, background 0.15s',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: mix('--color-accent', 0.15),
    color: colors.accent,
    flexShrink: 0,
  },
  label: {
    flex: 1,
    lineHeight: '1.4',
  },
  arrow: {
    flexShrink: 0,
    color: colors.accent,
    opacity: 0.7,
  },
} as const

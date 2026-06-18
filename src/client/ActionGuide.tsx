import {
  CheckCircle,
  type LucideIcon,
  Mountain,
  Plus,
  Send,
  Vote,
} from 'lucide-react'
import { useMemo } from 'react'
import type { Poll } from '../shared/types.d'
import type { StatusFilter } from './ProposalsGrid'
import { colors, fontSizes, fonts, mix } from './theme'
import { formatDate } from './utils'

type NodeStatus = 'pending' | 'active'

export type ProposalDetail = {
  proposalId: string
  subTab: 'proposal' | 'accommodations' | 'discussion'
}

interface ActionChip {
  label: string
  boldSuffix?: string
  tab: 'resorts' | 'proposals' | 'poll'
  statusFilter?: StatusFilter
  detail?: ProposalDetail
  variant: 'primary' | 'secondary'
}

interface GuideNodeData {
  nodeId: string
  icon: LucideIcon
  title: string
  subtitle?: string
  stats: string[]
  actions: ActionChip[]
  status: NodeStatus
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: StatusFilter,
    detail?: ProposalDetail
  ) => void
}

interface ActionGuideProps {
  resortCount: number
  draftCount: number
  myDrafts: Array<{ proposalId: string; resortName: string }>
  submittedProposals: Array<{ proposalId: string; resortName: string }>
  draftsForDiscussion: Array<{ proposalId: string; resortName: string }>
  closedPollCount: number
  activePoll: Poll | undefined
  userVotedInActivePoll: boolean
  isCoordinator: boolean
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: StatusFilter,
    detail?: ProposalDetail
  ) => void
}

function buildGuideNodes(props: ActionGuideProps): GuideNodeData[] {
  const nav = props.onNavigateToTab

  const resortsActions: ActionChip[] = []
  if (props.resortCount > 0) {
    resortsActions.push({
      label: `Browse ${props.resortCount} resort${props.resortCount !== 1 ? 's' : ''}`,
      tab: 'resorts',
      variant: 'primary',
    })
  }

  const draftActions: ActionChip[] = []
  if (props.draftCount > 0) {
    draftActions.push({
      label: `Browse ${props.draftCount} draft${props.draftCount !== 1 ? 's' : ''}`,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      variant: 'primary',
    })
  }
  for (const draft of props.myDrafts) {
    draftActions.push({
      label: `Accommodation for: `,
      boldSuffix: draft.resortName,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      detail: { proposalId: draft.proposalId, subTab: 'accommodations' },
      variant: 'primary',
    })
  }
  for (const draft of props.draftsForDiscussion) {
    draftActions.push({
      label: `Comment on: `,
      boldSuffix: draft.resortName,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      detail: { proposalId: draft.proposalId, subTab: 'discussion' },
      variant: 'primary',
    })
  }
  if (props.myDrafts.length > 0) {
    draftActions.push({
      label: props.myDrafts.length === 1 ? `Submit: ` : 'Submit',
      boldSuffix:
        props.myDrafts.length === 1 ? props.myDrafts[0].resortName : undefined,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      detail:
        props.myDrafts.length === 1
          ? { proposalId: props.myDrafts[0].proposalId, subTab: 'proposal' }
          : undefined,
      variant: 'primary',
    })
  }

  const submittedActions: ActionChip[] = []
  if (props.submittedProposals.length > 0) {
    submittedActions.push({
      label: `Browse ${props.submittedProposals.length} submitted`,
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      variant: 'primary',
    })
  }
  for (const proposal of props.submittedProposals) {
    submittedActions.push({
      label: `Discuss: `,
      boldSuffix: proposal.resortName,
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      detail: { proposalId: proposal.proposalId, subTab: 'discussion' },
      variant: 'primary',
    })
  }

  const pollStats: string[] = []
  const pollActions: ActionChip[] = []
  let pollSubtitle: string | undefined
  if (props.activePoll) {
    pollSubtitle = `Closes ${formatDate(props.activePoll.endDate)}`
    if (!props.userVotedInActivePoll) {
      pollActions.push({
        label: 'Vote now',
        tab: 'poll',
        variant: 'primary',
      })
    } else {
      pollActions.push({
        label: 'View poll',
        tab: 'poll',
        variant: 'primary',
      })
      pollStats.push("You've voted")
    }
  } else if (props.submittedProposals.length > 0 && props.isCoordinator) {
    pollActions.push({
      label: 'Create poll',
      tab: 'poll',
      variant: 'primary',
    })
  }

  const resultsActions: ActionChip[] = []
  if (props.closedPollCount > 0) {
    resultsActions.push({
      label: `Review ${props.closedPollCount} past poll${props.closedPollCount !== 1 ? 's' : ''}`,
      tab: 'poll',
      variant: 'secondary',
    })
  }

  return [
    {
      nodeId: 'resorts',
      icon: Mountain,
      title: 'Resort Catalog',
      stats: [],
      actions: resortsActions,
      status: props.resortCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'drafts',
      icon: Plus,
      title: 'Draft Proposals',
      stats: [],
      actions: draftActions,
      status: props.draftCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'submitted',
      icon: Send,
      title: 'Submitted Proposals',
      stats: [],
      actions: submittedActions,
      status: props.submittedProposals.length > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'poll',
      icon: Vote,
      title: 'Poll',
      subtitle: pollSubtitle,
      stats: pollStats,
      actions: pollActions,
      status: props.activePoll
        ? 'active'
        : props.submittedProposals.length > 0 && props.isCoordinator
          ? 'active'
          : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'results',
      icon: CheckCircle,
      title: 'Results',
      stats: [],
      actions: resultsActions,
      status: props.closedPollCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
  ]
}

const nodeSlideColor: Record<string, string> = {
  resorts: '--color-palette0',
  drafts: '--color-palette1',
  submitted: '--color-palette2',
  poll: '--color-palette3',
  results: '--color-palette4',
}

const tabMap: Record<string, 'resorts' | 'proposals' | 'poll'> = {
  resorts: 'resorts',
  drafts: 'proposals',
  submitted: 'proposals',
  poll: 'poll',
  results: 'poll',
}

function GuideNode({ data }: { data: GuideNodeData }) {
  const {
    icon: Icon,
    title,
    subtitle,
    stats,
    actions,
    status,
    onNavigateToTab,
    nodeId,
  } = data
  const colorToken = nodeSlideColor[nodeId] ?? '--color-palette0'
  const isActive = status === 'active'
  const borderLeftColor = isActive
    ? mix(colorToken, 0.8)
    : mix('--color-textSecondary', 0.15)
  const iconBg = isActive ? mix(colorToken, 0.25) : mix(colorToken, 0.08)
  const iconColor = isActive ? `var(${colorToken})` : mix(colorToken, 0.4)
  const textColor = isActive
    ? colors.textPrimary
    : mix('--color-textSecondary', 0.6)
  const bgColor = isActive
    ? mix(colorToken, 0.12)
    : mix('--color-textSecondary', 0.04)
  const borderColor = isActive
    ? mix(colorToken, 0.35)
    : mix('--color-textSecondary', 0.12)

  return (
    <div
      data-node={nodeId}
      data-status={status}
      className={`action-guide-node ${status === 'active' ? 'action-guide-node-pulse' : ''}`}
      style={{
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        ...(status === 'active'
          ? { borderLeftWidth: '3px', borderLeftColor: borderLeftColor }
          : {}),
        borderRadius: '10px',
        padding: '10px 14px 8px',
        fontFamily: fonts.body,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '180px',
      }}
    >
      <button
        type="button"
        onClick={() => {
          const primaryAction = actions[0]
          if (primaryAction) {
            onNavigateToTab(
              primaryAction.tab,
              primaryAction.statusFilter,
              primaryAction.detail
            )
          } else {
            onNavigateToTab(tabMap[nodeId])
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: iconColor }} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: '14px',
              fontWeight: '600',
              color: textColor,
              lineHeight: '1.2',
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: '11px',
                color: iconColor,
                lineHeight: '1.2',
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {stats.length > 0 && (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: '11px',
            color: iconColor,
            lineHeight: '1.3',
            fontWeight: '500',
            marginLeft: '36px',
          }}
        >
          {stats.join(' · ')}
        </div>
      )}
      {actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '4px',
            marginLeft: '36px',
            marginBottom: '0',
          }}
        >
          {actions.map((action) => (
            <button
              key={
                action.detail
                  ? `${action.detail.proposalId}-${action.detail.subTab}`
                  : action.label
              }
              type="button"
              className={
                action.variant === 'primary'
                  ? 'action-guide-action-glow'
                  : undefined
              }
              style={{
                fontFamily: fonts.body,
                fontSize: '11px',
                fontWeight: '500',
                padding: '3px 9px',
                borderRadius: '12px',
                border: `1px solid ${action.variant === 'primary' ? mix(colorToken, 0.5) : mix('--color-textSecondary', 0.2)}`,
                background:
                  action.variant === 'primary'
                    ? mix(colorToken, 0.15)
                    : 'transparent',
                color:
                  action.variant === 'primary'
                    ? `var(${colorToken})`
                    : mix('--color-textSecondary', 0.7),
                cursor: 'pointer',
                lineHeight: '1.3',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onClick={(e) => {
                e.stopPropagation()
                onNavigateToTab(action.tab, action.statusFilter, action.detail)
              }}
            >
              {action.label}
              {action.boldSuffix && <strong>{action.boldSuffix}</strong>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FlowConnector({
  sourceStatus,
  targetStatus,
  colorToken,
  targetColorToken,
}: {
  sourceStatus: NodeStatus
  targetStatus: NodeStatus
  colorToken: string
  targetColorToken: string
}) {
  const isActive = sourceStatus === 'active' && targetStatus === 'active'
  const inactiveColor =
    'color-mix(in srgb, var(--color-textSecondary) 50%, transparent)'
  const fromColor = isActive ? `var(${colorToken})` : inactiveColor
  const toColor = isActive ? `var(${targetColorToken})` : inactiveColor
  const strokeWidth = isActive ? 2 : 1.5
  const dashArray = isActive ? undefined : '5 3'
  const gradientId = `flow-grad-${colorToken.slice(2)}-${targetColorToken.slice(2)}`
  return (
    <svg
      data-connector
      data-active={isActive ? 'true' : undefined}
      width="8"
      height="32"
      viewBox="0 0 8 32"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', margin: '0 auto', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="0"
          x2="4"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" style={{ stopColor: fromColor }} />
          <stop offset="100%" style={{ stopColor: toColor }} />
        </linearGradient>
      </defs>
      <line
        x1="4"
        y1="0"
        x2="4"
        y2="32"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
      />
      {isActive && (
        <>
          <circle r="3" fill={`var(${colorToken})`}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path="M4,0 L4,32"
            />
          </circle>
          <circle r="3" fill={`var(${colorToken})`}>
            <animateMotion
              dur="2s"
              begin="1s"
              repeatCount="indefinite"
              path="M4,0 L4,32"
            />
          </circle>
        </>
      )}
      {!isActive && (
        <>
          <circle r="1.5" fill={inactiveColor}>
            <animateMotion
              dur="4s"
              repeatCount="indefinite"
              path="M4,0 L4,32"
            />
          </circle>
          <circle r="1.5" fill={inactiveColor}>
            <animateMotion
              dur="4s"
              begin="2s"
              repeatCount="indefinite"
              path="M4,0 L4,32"
            />
          </circle>
        </>
      )}
    </svg>
  )
}

export default function ActionGuide(props: ActionGuideProps) {
  const guideNodes = buildGuideNodes(props)

  const edges = useMemo(() => {
    const result: Array<{
      sourceStatus: NodeStatus
      targetStatus: NodeStatus
      targetColorToken: string
    }> = []
    for (let i = 0; i < guideNodes.length - 1; i++) {
      const source = guideNodes[i]
      const target = guideNodes[i + 1]
      result.push({
        sourceStatus: source.status,
        targetStatus: target.status,
        targetColorToken: nodeSlideColor[target.nodeId] ?? '--color-palette0',
      })
    }
    return result
  }, [guideNodes])

  return (
    <section style={actionGuideStyles.container}>
      <div style={actionGuideStyles.header}>
        <h3 style={actionGuideStyles.heading}>What's Next</h3>
      </div>
      <div style={actionGuideStyles.flowWrap}>
        {guideNodes.map((node, i) => (
          <div key={node.nodeId} style={actionGuideStyles.nodeWrap}>
            <GuideNode data={node} />
            {i < guideNodes.length - 1 && (
              <FlowConnector
                sourceStatus={edges[i].sourceStatus}
                targetStatus={edges[i].targetStatus}
                colorToken={
                  nodeSlideColor[guideNodes[i].nodeId] ?? '--color-palette0'
                }
                targetColorToken={edges[i].targetColorToken}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

const actionGuideStyles = {
  container: {
    marginTop: '48px',
    marginBottom: '32px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  heading: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    margin: 0,
  },
  flowWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0',
    width: '100%',
    maxWidth: '320px',
    margin: '0 auto',
  },
  nodeWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: '100%',
  },
} as const

import {
  type Edge,
  type EdgeProps,
  getBezierPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  BarChart3,
  CheckCircle,
  type LucideIcon,
  Mountain,
  Plus,
  Send,
  Vote,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import type { StatusFilter } from './ProposalsGrid'
import { colors, fontSizes, fonts, mix } from './theme'
import type { Poll } from './types.d.ts'
import { formatDate } from './utils'

type NodeStatus = 'pending' | 'active' | 'completed'

interface ActionChip {
  label: string
  tab: 'resorts' | 'proposals' | 'poll'
  statusFilter?: StatusFilter
  variant: 'primary' | 'secondary'
}

interface GuideNodeData extends Record<string, unknown> {
  nodeId: string
  icon: LucideIcon
  title: string
  subtitle?: string
  stats: string[]
  actions: ActionChip[]
  selfActions: ActionChip[]
  status: NodeStatus
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: StatusFilter
  ) => void
}

interface ActionGuideProps {
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
  const draftSelfActions: ActionChip[] = []
  if (props.draftCount > 0) {
    draftActions.push({
      label: `Browse ${props.draftCount} draft${props.draftCount !== 1 ? 's' : ''}`,
      tab: 'proposals',
      statusFilter: 'DRAFT',
      variant: 'primary',
    })
    draftActions.push({
      label: 'Submit',
      tab: 'proposals',
      statusFilter: 'DRAFT',
      variant: 'secondary',
    })
    draftSelfActions.push({
      label: 'Accommodations',
      tab: 'proposals',
      statusFilter: 'DRAFT',
      variant: 'secondary',
    })
    draftSelfActions.push({
      label: 'Discuss',
      tab: 'proposals',
      statusFilter: 'DRAFT',
      variant: 'secondary',
    })
  }

  const submittedActions: ActionChip[] = []
  if (props.submittedCount > 0) {
    submittedActions.push({
      label: `Comment on ${props.submittedCount} submitted`,
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      variant: props.draftCount === 0 ? 'primary' : 'secondary',
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
        variant: 'secondary',
      })
      pollStats.push("You've voted")
    }
  } else if (props.submittedCount > 0 && props.isCoordinator) {
    pollActions.push({
      label: 'Create poll',
      tab: 'poll',
      variant: 'primary',
    })
  }

  const resultsActions: ActionChip[] = []
  if (props.approvedCount > 0) {
    resultsActions.push({
      label: `View ${props.approvedCount} approved`,
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      variant: 'secondary',
    })
  }
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
      selfActions: [],
      status: props.resortCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'drafts',
      icon: Plus,
      title: 'Draft Proposals',
      stats: [],
      actions: draftActions,
      selfActions: draftSelfActions,
      status: props.draftCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'submitted',
      icon: Send,
      title: 'Submitted Proposals',
      stats: [],
      actions: submittedActions,
      selfActions: [],
      status: props.submittedCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'poll',
      icon: Vote,
      title: 'Poll',
      subtitle: pollSubtitle,
      stats: pollStats,
      actions: pollActions,
      selfActions: [],
      status: props.activePoll
        ? 'active'
        : props.submittedCount > 0 && props.isCoordinator
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
      selfActions: [],
      status:
        props.approvedCount > 0 || props.closedPollCount > 0
          ? 'completed'
          : 'pending',
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

const statusBorders: Record<NodeStatus, { borderLeft: string }> = {
  pending: {
    borderLeft: mix('--color-textSecondary', 0.15),
  },
  active: {
    borderLeft: 'var(--color-accent)',
  },
  completed: {
    borderLeft: 'color-mix(in srgb, var(--color-medalGold) 30%, transparent)',
  },
}

const statusIcon: Record<NodeStatus, { iconBg: string; iconColor: string }> = {
  pending: {
    iconBg: mix('--color-textSecondary', 0.1),
    iconColor: mix('--color-textSecondary', 0.4),
  },
  active: {
    iconBg: mix('--color-accent', 0.15),
    iconColor: colors.accent,
  },
  completed: {
    iconBg: 'color-mix(in srgb, var(--color-medalGold) 15%, transparent)',
    iconColor: colors.medalGold,
  },
}

const statusText: Record<NodeStatus, string> = {
  pending: mix('--color-textSecondary', 0.6),
  active: colors.textPrimary,
  completed: colors.textPrimary,
}

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps & { data?: { status?: NodeStatus } }) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const status = data?.status ?? 'pending'
  const isActive = status === 'active' || status === 'completed'
  const strokeColor = isActive
    ? 'var(--color-accent)'
    : 'color-mix(in srgb, var(--color-textSecondary) 25%, transparent)'
  const strokeWidth = isActive ? 2 : 1.5

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isActive ? undefined : '5 3'}
      />
      {isActive && (
        <circle r="3" fill="var(--color-accent)">
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  )
}

const edgeTypes = {
  statusFlow: FlowEdge,
}

function FlowNode({ data }: NodeProps<Node<GuideNodeData>>) {
  const {
    icon: Icon,
    title,
    subtitle,
    stats,
    actions,
    selfActions,
    status,
    onNavigateToTab,
    nodeId,
  } = data
  const border = statusBorders[status]
  const icon = statusIcon[status]
  const text = statusText[status]
  const colorToken = nodeSlideColor[nodeId] ?? '--color-palette0'
  const bgColor = mix(colorToken, 0.25)
  const borderColor = mix(colorToken, 0.35)

  const tabMap: Record<string, 'resorts' | 'proposals' | 'poll'> = {
    resorts: 'resorts',
    drafts: 'proposals',
    submitted: 'proposals',
    poll: 'poll',
    results: 'poll',
  }

  return (
    <div
      data-node={nodeId}
      data-status={status}
      className={`action-guide-node ${status === 'active' ? 'action-guide-node-pulse' : ''}`}
      style={{
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        ...(status === 'active'
          ? { borderLeftWidth: '3px', borderLeftColor: border.borderLeft }
          : {}),
        borderRadius: '10px',
        padding: '10px 14px 8px',
        fontFamily: fonts.body,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '180px',
        pointerEvents: 'auto',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={hiddenHandleStyle}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        style={hiddenHandleStyle}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={hiddenHandleStyle}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        style={hiddenHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        style={hiddenHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={hiddenHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        style={hiddenHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={hiddenHandleStyle}
      />
      <button
        type="button"
        onClick={() => {
          const primaryAction = actions[0]
          if (primaryAction) {
            onNavigateToTab(primaryAction.tab, primaryAction.statusFilter)
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
            background: icon.iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: icon.iconColor }} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: '14px',
              fontWeight: '600',
              color: text,
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
                color: icon.iconColor,
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
            color: icon.iconColor,
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
            flexWrap: 'wrap' as const,
            gap: '4px',
            marginLeft: '36px',
            marginBottom: selfActions.length > 0 ? '3px' : '0',
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
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
                border: `1px solid ${action.variant === 'primary' ? mix('--color-accent', 0.35) : mix('--color-textSecondary', 0.2)}`,
                background:
                  action.variant === 'primary'
                    ? mix('--color-accent', 0.1)
                    : 'transparent',
                color:
                  action.variant === 'primary'
                    ? colors.accent
                    : mix('--color-textSecondary', 0.7),
                cursor: 'pointer',
                lineHeight: '1.3',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onClick={(e) => {
                e.stopPropagation()
                onNavigateToTab(action.tab, action.statusFilter)
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {selfActions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '4px',
            marginLeft: '36px',
          }}
        >
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: '10px',
              color: mix('--color-textSecondary', 0.45),
              marginRight: '1px',
            }}
          >
            ↻
          </span>
          {selfActions.map((action) => (
            <button
              key={action.label}
              type="button"
              style={{
                fontFamily: fonts.body,
                fontSize: '10px',
                fontWeight: '400',
                padding: '2px 7px',
                borderRadius: '9px',
                border: `1px solid ${mix('--color-textSecondary', 0.15)}`,
                background: 'transparent',
                color: mix('--color-textSecondary', 0.55),
                cursor: 'pointer',
                lineHeight: '1.3',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onClick={(e) => {
                e.stopPropagation()
                onNavigateToTab(action.tab, action.statusFilter)
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const hiddenHandleStyle = { opacity: 0, width: 1, height: 1 }

const nodeTypes = {
  guideNode: FlowNode,
}

const nodePositions: Record<string, { x: number; y: number }> = {
  resorts: { x: 0, y: 0 },
  drafts: { x: 0, y: 150 },
  submitted: { x: 0, y: 300 },
  poll: { x: 0, y: 450 },
  results: { x: 0, y: 600 },
}

const edgeRoutes: Record<
  string,
  { sourceHandle: string; targetHandle: string }
> = {
  'resorts-drafts': {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-top',
  },
  'drafts-submitted': {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-top',
  },
  'submitted-poll': {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-top',
  },
  'poll-results': {
    sourceHandle: 'source-bottom',
    targetHandle: 'target-top',
  },
}

export default function ActionGuide(props: ActionGuideProps) {
  const guideNodes = buildGuideNodes(props)

  const flowNodes: Node<GuideNodeData>[] = useMemo(
    () =>
      guideNodes.map((node) => {
        const pos = nodePositions[node.nodeId] ?? { x: 0, y: 0 }
        return {
          id: node.nodeId,
          type: 'guideNode' as const,
          position: pos,
          data: node,
          draggable: false,
        }
      }),
    [guideNodes]
  )

  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []
    for (let i = 0; i < guideNodes.length - 1; i++) {
      const source = guideNodes[i]
      const target = guideNodes[i + 1]
      const edgeId = `${source.nodeId}-${target.nodeId}`
      const edgeStatus: NodeStatus =
        source.status === 'completed'
          ? 'completed'
          : source.status === 'active'
            ? 'active'
            : 'pending'
      const route = edgeRoutes[edgeId]
      edges.push({
        id: edgeId,
        source: source.nodeId,
        target: target.nodeId,
        sourceHandle: route?.sourceHandle,
        targetHandle: route?.targetHandle,
        type: 'statusFlow',
        data: { status: edgeStatus },
      })
    }
    return edges
  }, [guideNodes])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'statusFlow' as const,
    }),
    []
  )

  const handleInit = useCallback(
    (instance: {
      fitView: (opts: { padding: number; duration: number }) => void
    }) => {
      requestAnimationFrame(() => {
        instance.fitView({ padding: 0.15, duration: 0 })
      })
    },
    []
  )

  return (
    <section style={actionGuideStyles.container}>
      <div style={actionGuideStyles.header}>
        <BarChart3 size={16} style={{ color: colors.accent }} />
        <h3 style={actionGuideStyles.heading}>What's Next</h3>
      </div>
      <div style={actionGuideStyles.flowWrap}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          nodeOrigin={[0.5, 0]}
          onInit={handleInit}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        />
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
    width: '100%',
    height: 'clamp(320px, 55vh, 600px)',
    position: 'relative' as const,
  },
} as const

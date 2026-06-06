import {
  type Edge,
  type EdgeProps,
  getBezierPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { useEffect, useMemo, useRef } from 'react'
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
  participantCount: number
  onNavigateToTab: (
    tab: 'resorts' | 'proposals' | 'poll',
    statusFilter?: StatusFilter
  ) => void
}

function buildGuideNodes(props: ActionGuideProps): GuideNodeData[] {
  const nav = props.onNavigateToTab

  const resortsStats: string[] = []
  if (props.resortCount > 0) {
    resortsStats.push(
      `${props.resortCount} resort${props.resortCount !== 1 ? 's' : ''}`
    )
  }
  const resortsActions: ActionChip[] = []
  if (props.resortCount > 0) {
    resortsActions.push({
      label: 'Browse resorts',
      tab: 'resorts',
      variant: 'primary',
    })
  }

  const draftStats: string[] = []
  const draftActions: ActionChip[] = []
  const draftSelfActions: ActionChip[] = []
  if (props.draftCount > 0) {
    draftStats.push(
      `${props.draftCount} draft${props.draftCount !== 1 ? 's' : ''}`
    )
    draftActions.push({
      label: `${props.draftCount} draft${props.draftCount !== 1 ? 's' : ''}`,
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

  const submittedStats: string[] = []
  const submittedActions: ActionChip[] = []
  if (props.submittedCount > 0) {
    submittedStats.push(`${props.submittedCount} submitted`)
    submittedActions.push({
      label: 'Comment',
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

  const resultsStats: string[] = []
  const resultsActions: ActionChip[] = []
  if (props.approvedCount > 0) {
    resultsStats.push(`${props.approvedCount} approved`)
    resultsActions.push({
      label: 'View',
      tab: 'proposals',
      statusFilter: 'SUBMITTED',
      variant: 'secondary',
    })
  }
  if (props.closedPollCount > 0) {
    resultsStats.push(
      `${props.closedPollCount} past poll${props.closedPollCount !== 1 ? 's' : ''}`
    )
    resultsActions.push({
      label: 'Review polls',
      tab: 'poll',
      variant: 'secondary',
    })
  }

  return [
    {
      nodeId: 'resorts',
      icon: Mountain,
      title: 'Resorts',
      stats: resortsStats,
      actions: resortsActions,
      selfActions: [],
      status: props.resortCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'drafts',
      icon: Plus,
      title: 'Drafts',
      stats: draftStats,
      actions: draftActions,
      selfActions: draftSelfActions,
      status: props.draftCount > 0 ? 'active' : 'pending',
      onNavigateToTab: nav,
    },
    {
      nodeId: 'submitted',
      icon: Send,
      title: 'Submitted',
      stats: submittedStats,
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
      stats: resultsStats,
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

const statusThemes: Record<
  NodeStatus,
  {
    bg: string
    border: string
    iconBg: string
    iconColor: string
    text: string
  }
> = {
  pending: {
    bg: mix('--color-textSecondary', 0.06),
    border: mix('--color-textSecondary', 0.15),
    iconBg: mix('--color-textSecondary', 0.1),
    iconColor: mix('--color-textSecondary', 0.4),
    text: mix('--color-textSecondary', 0.6),
  },
  active: {
    bg: mix('--color-accent', 0.08),
    border: mix('--color-accent', 0.35),
    iconBg: mix('--color-accent', 0.15),
    iconColor: colors.accent,
    text: colors.textPrimary,
  },
  completed: {
    bg: 'color-mix(in srgb, var(--color-medalGold) 8%, transparent)',
    border: 'color-mix(in srgb, var(--color-medalGold) 30%, transparent)',
    iconBg: 'color-mix(in srgb, var(--color-medalGold) 15%, transparent)',
    iconColor: colors.medalGold,
    text: colors.textPrimary,
  },
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
  const theme = statusThemes[status]

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
        background: theme.bg,
        border: `1.5px solid ${theme.border}`,
        ...(status === 'active'
          ? { borderLeftWidth: '3px', borderLeftColor: 'var(--color-accent)' }
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
            background: theme.iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={15} style={{ color: theme.iconColor }} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: '14px',
              fontWeight: '600',
              color: theme.text,
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
                color: theme.iconColor,
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
            color: theme.iconColor,
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

const NODE_W = 200
const CIRCLE_R = 240
const CIRCLE_CX = 300
const CIRCLE_CY = 260

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
    sourceHandle: 'source-left',
    targetHandle: 'target-right',
  },
  'poll-results': { sourceHandle: 'source-top', targetHandle: 'target-bottom' },
  'results-drafts-return': {
    sourceHandle: 'source-right',
    targetHandle: 'target-left',
  },
}

function AutoFitView({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId: number
    let timeoutId: ReturnType<typeof setTimeout>

    const scheduleFitView = () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() =>
          fitView({ padding: 0.15, duration: 200 })
        )
      }, 200)
    }

    const observer = new ResizeObserver(scheduleFitView)
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
    }
  }, [fitView, containerRef])

  return null
}

export default function ActionGuide(props: ActionGuideProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const guideNodes = buildGuideNodes(props)
  const showReturnPath = props.closedPollCount > 0 || props.approvedCount > 0

  const flowNodes: Node<GuideNodeData>[] = useMemo(
    () =>
      guideNodes.map((node, i) => {
        const angle = (i / guideNodes.length) * 2 * Math.PI - Math.PI / 2
        return {
          id: node.nodeId,
          type: 'guideNode' as const,
          position: {
            x: CIRCLE_CX + CIRCLE_R * Math.cos(angle) - NODE_W / 2,
            y: CIRCLE_CY + CIRCLE_R * Math.sin(angle) - 40,
          },
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
      const edgeStatus: NodeStatus =
        source.status === 'completed'
          ? 'completed'
          : source.status === 'active'
            ? 'active'
            : 'pending'
      const edgeId = `${source.nodeId}-${target.nodeId}`
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
    if (showReturnPath) {
      const resultsNode = guideNodes[guideNodes.length - 1]
      const draftsNode = guideNodes[1]
      const route = edgeRoutes['results-drafts-return']
      edges.push({
        id: 'results-drafts-return',
        source: resultsNode.nodeId,
        target: draftsNode.nodeId,
        sourceHandle: route?.sourceHandle,
        targetHandle: route?.targetHandle,
        type: 'statusFlow',
        data: { status: 'active' },
      })
    }
    return edges
  }, [guideNodes, showReturnPath])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'statusFlow' as const,
    }),
    []
  )

  return (
    <section style={actionGuideStyles.container}>
      <div style={actionGuideStyles.header}>
        <BarChart3 size={16} style={{ color: colors.accent }} />
        <h3 style={actionGuideStyles.heading}>What's Next</h3>
        <span style={actionGuideStyles.participants}>
          {props.participantCount} skier
          {props.participantCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div ref={containerRef} style={actionGuideStyles.flowWrap}>
        <ReactFlowProvider>
          <AutoFitView containerRef={containerRef} />
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.15 }}
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
        </ReactFlowProvider>
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
  participants: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: mix('--color-textSecondary', 0.6),
    marginLeft: 'auto',
  },
  flowWrap: {
    width: '100%',
    height: 'clamp(320px, 55vh, 600px)',
    position: 'relative' as const,
  },
} as const

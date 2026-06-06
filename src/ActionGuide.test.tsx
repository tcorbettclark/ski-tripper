import { describe, expect, it, mock } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import ActionGuide from './ActionGuide'
import type { Poll } from './types.d.ts'

mock.module('@xyflow/react', () => {
  function MockReactFlow({
    nodes,
  }: {
    nodes: Array<{ data: Record<string, unknown> }>
  }) {
    return (
      <div data-testid="react-flow">
        {nodes.map((node) => {
          const nodeId = String(node.data.nodeId ?? '')
          const status = String(node.data.status ?? '')
          const title = node.data.title ? String(node.data.title) : ''
          const subtitle = node.data.subtitle ? String(node.data.subtitle) : ''
          const stats = Array.isArray(node.data.stats)
            ? (node.data.stats as string[])
            : []
          const actions = Array.isArray(node.data.actions)
            ? (node.data.actions as Array<{
                label: string
                tab: string
                statusFilter?: string
              }>)
            : []
          const selfActions = Array.isArray(node.data.selfActions)
            ? (node.data.selfActions as Array<{
                label: string
                tab: string
                statusFilter?: string
              }>)
            : []
          const onNavigateToTab = node.data.onNavigateToTab as
            | ((tab: string, statusFilter?: string) => void)
            | undefined
          const tabMap: Record<string, string> = {
            resorts: 'resorts',
            drafts: 'proposals',
            submitted: 'proposals',
            poll: 'poll',
            results: 'poll',
          }
          return (
            <div key={nodeId} data-node={nodeId} data-status={status}>
              <button
                type="button"
                onClick={() => {
                  const primary = actions[0]
                  if (primary)
                    onNavigateToTab?.(primary.tab, primary.statusFilter)
                  else onNavigateToTab?.(tabMap[nodeId])
                }}
              >
                {title}
              </button>
              {subtitle && <span>{subtitle}</span>}
              {stats.map((s) => (
                <span key={s}>{s}</span>
              ))}
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNavigateToTab?.(a.tab, a.statusFilter)
                  }}
                >
                  {a.label}
                </button>
              ))}
              {selfActions.length > 0 && <span>↻</span>}
              {selfActions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNavigateToTab?.(a.tab, a.statusFilter)
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    ) as ReactNode
  }
  return {
    ReactFlow: MockReactFlow,
    getSmoothStepPath: () => ['', 0, 0, ''],
    EdgeProps: {},
    NodeProps: {},
    Node: {},
    Edge: {},
    useNodesState: () => [[], () => {}, undefined],
    useEdgesState: () => [[], () => {}, undefined],
    useOnSelectionChange: () => {},
    BaseEdge: () => null,
  }
})

const sampleActivePoll: Poll = {
  $id: 'poll-1',
  $createdAt: '2024-01-05T00:00:00Z',
  $updatedAt: '2024-01-05T00:00:00Z',
  pollCreatorUserId: 'user-1',
  pollCreatorUserName: 'Alice',
  state: 'OPEN',
  tripId: 'trip-1',
  proposalIds: ['prop-2'],
  startDate: '2024-01-05T00:00:00Z',
  endDate: '2024-01-12T00:00:00Z',
  outcome: '',
}

const defaultProps = {
  resortCount: 3,
  draftCount: 0,
  submittedCount: 0,
  approvedCount: 0,
  closedPollCount: 0,
  activePoll: undefined,
  userVotedInActivePoll: false,
  isCoordinator: false,
  onNavigateToTab: mock((_tab: string, _statusFilter?: string) => {}),
}

function renderActionGuide(props = {}) {
  return render(<ActionGuide {...defaultProps} {...props} />)
}

describe('ActionGuide', () => {
  it('renders the section heading', async () => {
    await act(async () => {
      renderActionGuide()
    })
    await waitFor(() => {
      expect(screen.getByText("What's Next"))
    })
  })

  it('renders all five journey nodes', async () => {
    await act(async () => {
      renderActionGuide()
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
      expect(screen.getByText('Drafts')).toBeTruthy()
      expect(screen.getByText('Submitted')).toBeTruthy()
      expect(screen.getByText('Poll')).toBeTruthy()
      expect(screen.getByText('Results')).toBeTruthy()
    })
  })

  it('shows resort count on the Resorts node', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 42 })
    })
    await waitFor(() => {
      expect(screen.getByText('42 resorts')).toBeTruthy()
    })
  })

  it('shows draft count on the Drafts node', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 2 })
    })
    await waitFor(() => {
      expect(screen.getAllByText('2 drafts').length).toBeGreaterThan(0)
    })
  })

  it('shows submitted count on the Submitted node', async () => {
    await act(async () => {
      renderActionGuide({ submittedCount: 3 })
    })
    await waitFor(() => {
      expect(screen.getByText('3 submitted')).toBeTruthy()
    })
  })

  it('shows approved count on the Results node', async () => {
    await act(async () => {
      renderActionGuide({ approvedCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('1 approved')).toBeTruthy()
    })
  })

  it('shows Vote now action when poll is active and user has not voted', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Vote now')).toBeTruthy()
    })
  })

  it('shows closing date when poll is active', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: false,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/Closes/)).toBeTruthy()
    })
  })

  it('shows poll status when user has voted', async () => {
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        userVotedInActivePoll: true,
      })
    })
    await waitFor(() => {
      expect(screen.getByText("You've voted")).toBeTruthy()
    })
  })

  it('shows Create poll action for coordinator with submitted proposals', async () => {
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: true,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Create poll')).toBeTruthy()
    })
  })

  it('does not show Create poll for non-coordinator', async () => {
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: false,
      })
    })
    await waitFor(() => {
      expect(screen.queryByText('Create poll')).toBeNull()
    })
  })

  it('shows closed poll count on Results node', async () => {
    await act(async () => {
      renderActionGuide({ closedPollCount: 2 })
    })
    await waitFor(() => {
      expect(screen.getByText('2 past polls')).toBeTruthy()
    })
  })

  it('shows self-loop actions on Drafts node', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Accommodations')).toBeTruthy()
      expect(screen.getByText('Discuss')).toBeTruthy()
    })
  })

  it('does not show self-loop actions when no drafts', async () => {
    await act(async () => {
      renderActionGuide({ draftCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Drafts')).toBeTruthy()
      expect(screen.queryByText('Accommodations')).toBeNull()
      expect(screen.queryByText('Discuss')).toBeNull()
    })
  })

  it('navigates to resorts tab when Resorts node clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({ onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Resorts'))
    expect(onNavigateToTab).toHaveBeenCalledWith('resorts', undefined)
  })

  it('navigates to poll tab when Vote now action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        activePoll: sampleActivePoll,
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Vote now')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Vote now'))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to poll tab when Create poll action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({
        submittedCount: 2,
        isCoordinator: true,
        onNavigateToTab,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Create poll')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Create poll'))
    expect(onNavigateToTab).toHaveBeenCalledWith('poll', undefined)
  })

  it('navigates to proposals with DRAFT filter when draft action clicked', async () => {
    const onNavigateToTab = mock(() => {})
    await act(async () => {
      renderActionGuide({ draftCount: 2, onNavigateToTab })
    })
    await waitFor(() => {
      expect(screen.getAllByText('2 drafts').length).toBeGreaterThan(0)
    })
    const draftButtons = screen
      .getAllByText('2 drafts')
      .filter((el) => el.tagName === 'BUTTON')
    fireEvent.click(draftButtons[0])
    expect(onNavigateToTab).toHaveBeenCalledWith('proposals', 'DRAFT')
  })

  it('applies active status to Resorts node when resorts exist', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 5 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
    })
    const resortsNode = screen.getByText('Resorts').closest('[data-node]')
    expect(resortsNode?.getAttribute('data-status')).toBe('active')
  })

  it('applies completed status to Results node when proposals approved', async () => {
    await act(async () => {
      renderActionGuide({ approvedCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Results')).toBeTruthy()
    })
    const resultsNode = screen.getByText('Results').closest('[data-node]')
    expect(resultsNode?.getAttribute('data-status')).toBe('completed')
  })

  it('applies pending status to a node with no activity', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 0 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
    })
    const resortsNode = screen.getByText('Resorts').closest('[data-node]')
    expect(resortsNode?.getAttribute('data-status')).toBe('pending')
  })

  it('renders connectors between nodes', async () => {
    await act(async () => {
      renderActionGuide({ resortCount: 3, draftCount: 1 })
    })
    await waitFor(() => {
      expect(screen.getByText('Resorts')).toBeTruthy()
    })
    const flowContainer = screen.getByTestId('react-flow')
    expect(flowContainer).toBeTruthy()
  })
})

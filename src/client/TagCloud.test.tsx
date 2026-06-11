import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import TagCloud from './TagCloud'

const commonItems = [
  { key: 'fr', label: 'France', imageUrl: '/flags/fr.png' },
  { key: 'ca', label: 'Canada', imageUrl: '/flags/ca.png' },
]

const uncommonItems = [
  { key: 'ar', label: 'Argentina', imageUrl: '/flags/ar.png' },
  { key: 'nz', label: 'New Zealand', imageUrl: '/flags/nz.png' },
]

function defaultTagCloudProps(overrides: Record<string, unknown> = {}) {
  return {
    commonItems,
    uncommonItems,
    selectedKeys: new Set<string>(),
    onToggle: () => {},
    ...overrides,
  }
}

describe('TagCloud', () => {
  it('renders common items', () => {
    render(<TagCloud {...defaultTagCloudProps()} />)
    expect(screen.getByTitle('France')).toBeTruthy()
    expect(screen.getByTitle('Canada')).toBeTruthy()
  })

  it('does not render uncommon items by default', () => {
    render(<TagCloud {...defaultTagCloudProps()} />)
    expect(screen.queryByTitle('Argentina')).toBeNull()
    expect(screen.queryByTitle('New Zealand')).toBeNull()
  })

  it('renders more link with count when there are uncommon items', () => {
    render(<TagCloud {...defaultTagCloudProps()} />)
    expect(screen.getByRole('button', { name: '+2 more' })).toBeTruthy()
  })

  it('expands to show uncommon items when more is clicked', () => {
    render(<TagCloud {...defaultTagCloudProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
    expect(screen.getByTitle('Argentina')).toBeTruthy()
    expect(screen.getByTitle('New Zealand')).toBeTruthy()
  })

  it('collapses uncommon items when less is clicked', () => {
    render(<TagCloud {...defaultTagCloudProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
    expect(screen.getByTitle('Argentina')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /less/i }))
    expect(screen.queryByTitle('Argentina')).toBeNull()
  })

  it('calls onToggle when a common tag is clicked', () => {
    const onToggle = (key: string) => toggledKeys.push(key)
    const toggledKeys: string[] = []
    render(<TagCloud {...defaultTagCloudProps({ onToggle })} />)

    fireEvent.click(screen.getByTitle('France'))
    expect(toggledKeys).toEqual(['fr'])
  })

  it('calls onToggle when an uncommon tag is clicked after expanding', () => {
    const onToggle = (key: string) => toggledKeys.push(key)
    const toggledKeys: string[] = []
    render(<TagCloud {...defaultTagCloudProps({ onToggle })} />)

    fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
    fireEvent.click(screen.getByTitle('Argentina'))
    expect(toggledKeys).toEqual(['ar'])
  })

  it('does not render more link when there are no uncommon items', () => {
    render(<TagCloud {...defaultTagCloudProps({ uncommonItems: [] })} />)
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull()
  })

  it('renders text labels for items without imageUrl', () => {
    const textItems = [
      { key: 'alps', label: 'Alps' },
      { key: 'andes', label: 'Andes' },
    ]
    render(
      <TagCloud
        {...defaultTagCloudProps({
          commonItems: textItems,
          uncommonItems: [],
        })}
      />
    )
    expect(screen.getByTitle('Alps')).toBeTruthy()
    expect(screen.getByTitle('Andes')).toBeTruthy()
  })

  it('returns null when no items', () => {
    const { container } = render(
      <TagCloud
        commonItems={[]}
        uncommonItems={[]}
        selectedKeys={new Set()}
        onToggle={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})

import { Component, type ReactNode } from 'react'
import { colors, fonts } from './theme'

interface ErrorBoundaryProps {
  children?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <p style={styles.emoji}>⚠️</p>
          <h2 style={styles.heading}>Something went wrong</h2>
          <p style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={styles.button}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const styles = {
  container: {
    padding: '80px 48px',
    maxWidth: '960px',
    margin: '0 auto',
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  emoji: {
    fontSize: '48px',
    margin: '0 0 16px',
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: '24px',
    fontWeight: '600',
    color: colors.textPrimary,
    margin: '0 0 12px',
  },
  message: {
    fontSize: '14px',
    color: colors.textSecondary,
    margin: '0 0 24px',
  },
  button: {
    padding: '9px 22px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
} as const

export default ErrorBoundary

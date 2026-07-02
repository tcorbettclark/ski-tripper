import { useRef, useState } from 'react'
import packageJson from '../../package.json' with { type: 'json' }
import { colors, fontSizes, fonts } from './theme'
import useAutoHideFooter from './useAutoHideFooter'

const VERSION = packageJson.version
const GITHUB_URL = 'https://github.com/tcorbettclark/ski-tripper'
const AUTHOR_URL = 'https://www.corbettclark.com'

interface FooterProps {
  useAutoHideFooterHook?: () => 'visible' | 'hidden'
  isSmall?: boolean
}

export default function Footer({
  useAutoHideFooterHook = useAutoHideFooter,
  isSmall = false,
}: FooterProps = {}) {
  const visibility = useAutoHideFooterHook()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerRef = useRef<HTMLElement>(null)

  if (isSmall) return null

  if (footerRef.current && footerRef.current.offsetHeight !== footerHeight) {
    setFooterHeight(footerRef.current.offsetHeight)
  }

  const visibilityStyle =
    visibility === 'hidden'
      ? { opacity: 0, pointerEvents: 'none' as const }
      : { opacity: 1 }

  return (
    <>
      {footerHeight > 0 && <div style={{ height: footerHeight }} />}
      <footer
        ref={footerRef}
        style={{ ...footerStyles.bar, ...visibilityStyle }}
      >
        <span style={footerStyles.separator}>·</span>
        <span style={footerStyles.text}>
          Built by{' '}
          <a
            href={AUTHOR_URL}
            style={footerStyles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Timothy Corbett-Clark
          </a>
        </span>
        <span style={footerStyles.separator}>·</span>
        <a
          href={GITHUB_URL}
          style={footerStyles.iconLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            role="img"
            aria-label="GitHub"
          >
            <title>GitHub</title>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <span style={footerStyles.separator}>·</span>
        <span style={footerStyles.text}>v{VERSION}</span>
      </footer>
    </>
  )
}

const footerStyles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px 16px',
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: colors.bgPrimary,
    flexWrap: 'wrap' as const,
    transition: 'opacity 0.3s ease',
  },
  text: {
    color: colors.textSecondary,
  },
  link: {
    color: colors.accent,
    textDecoration: 'none',
  },
  iconLink: {
    color: colors.accent,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  separator: {
    color: colors.textSecondary,
    opacity: 0.4,
  },
} as const

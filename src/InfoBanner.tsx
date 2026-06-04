import {
  CircleDot,
  Compass,
  FileText,
  type LucideIcon,
  Mountain,
  Snowflake,
  ThumbsUp,
  UserPlus,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { colors, fonts, mix } from './theme'

const slideColors = [
  '#3bbde8',
  '#5ecfcf',
  '#8be28a',
  '#e2c94a',
  '#e89a3b',
  '#e26a7b',
  '#b08be2',
]

const defaultSlides = [
  {
    icon: Snowflake,
    text: 'A collaborative ski trip planning application.\nCut down on the chaos!',
  },
  {
    icon: UserPlus,
    text: 'Signup with your email, set your skiing/snowboarding holiday preferences, and create or join a trip via a simple three-word code.',
  },
  {
    icon: Mountain,
    text: 'Browse thousands of resorts from an AI-enriched catalogue, packed with detail.',
  },
  {
    icon: FileText,
    text: 'Create proposals with dates and descriptions, discuss with comments, then submit for voting.',
  },
  {
    icon: ThumbsUp,
    text: 'The trip Coordinator runs multiple rounds of voting to arrive at a consensus.',
  },
  {
    icon: CircleDot,
    text: 'Have your say by allocating your "chips" amongst the submitted proposals.',
  },
  { icon: Compass, text: 'Guided "what next?" prompts stop you getting lost.' },
]

interface Slide {
  icon: LucideIcon
  text: string
}

interface InfoBannerProps {
  intervalMs?: number
  slides?: Slide[]
}

export const FADE_DURATION_MS = 300

export default function InfoBanner({
  intervalMs = 4000,
  slides = defaultSlides,
}: InfoBannerProps) {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const advancingRef = useRef(false)

  const advance = useCallback(() => {
    if (advancingRef.current) return
    advancingRef.current = true
    setVisible(false)
    setTimeout(() => {
      setActive((i) => (i + 1) % slides.length)
      setVisible(true)
      advancingRef.current = false
    }, FADE_DURATION_MS)
  }, [slides.length])

  useEffect(() => {
    if (paused) return
    const id = setInterval(advance, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, paused, advance])

  return (
    <section
      aria-label="Feature highlights"
      style={bannerStyles.container}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        style={{
          ...bannerStyles.slide,
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
        }}
      >
        {(() => {
          const Icon = slides[active].icon
          const color = slideColors[active % slideColors.length]
          return <Icon size={20} color={color} style={bannerStyles.icon} />
        })()}
        <div style={bannerStyles.textWrap}>
          <p
            style={{
              ...bannerStyles.text,
              color: slideColors[active % slideColors.length],
              whiteSpace: 'pre-line' as const,
            }}
          >
            {slides[active].text}
          </p>
        </div>
        <div style={bannerStyles.dots}>
          {slides.map((_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: dots are visual indicators for a static list
              key={i}
              style={
                i === active
                  ? {
                      ...bannerStyles.dot,
                      background: slideColors[i % slideColors.length],
                    }
                  : bannerStyles.dot
              }
            />
          ))}
        </div>
      </div>
      {paused && (
        <span style={bannerStyles.pauseIcon} aria-hidden="true">
          &#9646;&#9646;
        </span>
      )}
    </section>
  )
}

const bannerStyles = {
  container: {
    maxWidth: '420px',
    width: '100%',
    marginTop: '20px',
    textAlign: 'center' as const,
    position: 'relative' as const,
    zIndex: 1,
  },
  slide: {},
  textWrap: {
    minHeight: '60px',
  },
  text: {
    fontFamily: fonts.body,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '4px auto 12px auto',
    width: '80%',
  },
  icon: {
    margin: '0 auto',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: mix('--color-textSecondary', 0.25),
    display: 'inline-block',
  },
  pauseIcon: {
    position: 'absolute' as const,
    bottom: '0',
    right: '0',
    fontSize: '10px',
    lineHeight: '1',
    color: colors.textSecondary,
    opacity: '0.5',
  },
}

import {
  Binoculars,
  CircleDot,
  Compass,
  FileText,
  type LucideIcon,
  Mountain,
  Snowflake,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Paragraphs from './Paragraphs'
import { colors, fontSizes, fonts, mix } from './theme'
import useIsSmallScreen from './useIsSmallScreen'

const slideColorKeys: (keyof typeof colors)[] = [
  'palette0',
  'palette1',
  'palette2',
  'palette3',
  'palette4',
  'palette5',
  'palette6',
  'palette7',
]

const defaultSlides = [
  {
    icon: Snowflake,
    text: 'A collaborative ski trip planning application. Cut down on the chaos!',
  },
  {
    icon: UserPlus,
    text: 'Signup with your email and set your skiing/snowboarding holiday preferences.',
  },
  {
    icon: Users,
    text: 'Create or join a trip via a simple three-word code.',
  },
  {
    icon: Mountain,
    text: 'Browse thousands of resorts from an AI-enriched catalogue.',
  },
  {
    icon: Binoculars,
    text: "Use built-in AI to find resorts matching people's likes and dislikes.",
  },
  {
    icon: FileText,
    text: 'Create proposals with dates and descriptions, discuss with comments, then submit for voting.',
  },
  {
    icon: Sparkles,
    text: 'Use built-in AI to identify the pros/cons of a proposal.',
  },
  {
    icon: CircleDot,
    text: 'Have your say by allocating your "chips" amongst the submitted proposals.',
  },
  {
    icon: ThumbsUp,
    text: 'The trip Coordinator runs multiple rounds of voting to arrive at a consensus.',
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
  useIsSmallScreenHook?: () => boolean
}

export const FADE_DURATION_MS = 300

export default function InfoBanner({
  intervalMs = 4000,
  slides = defaultSlides,
  useIsSmallScreenHook = useIsSmallScreen,
}: InfoBannerProps) {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const [skipTransition, setSkipTransition] = useState(false)
  const advancingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSmallScreen = useIsSmallScreenHook()

  const cancelPendingFade = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    advancingRef.current = false
  }, [])

  const advance = useCallback(() => {
    if (advancingRef.current) return
    advancingRef.current = true
    setSkipTransition(false)
    setVisible(false)
    timeoutRef.current = setTimeout(() => {
      setActive((i) => (i + 1) % slides.length)
      setVisible(true)
      advancingRef.current = false
      timeoutRef.current = null
    }, FADE_DURATION_MS)
  }, [slides.length])

  const goTo = useCallback(
    (i: number) => {
      if (i === active) return
      cancelPendingFade()
      setSkipTransition(true)
      setActive(i)
      setVisible(true)
    },
    [active, cancelPendingFade]
  )

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
          transition: skipTransition
            ? 'none'
            : `opacity ${FADE_DURATION_MS}ms ease-in-out`,
        }}
      >
        {(() => {
          const Icon = slides[active].icon
          const colorKey = slideColorKeys[active % slideColorKeys.length]
          return (
            <Icon
              size={20}
              color={colors[colorKey]}
              style={bannerStyles.icon}
            />
          )
        })()}
        <div style={bannerStyles.textWrap}>
          <Paragraphs
            text={slides[active].text}
            style={{
              ...bannerStyles.text,
              color: colors[slideColorKeys[active % slideColorKeys.length]],
            }}
          />
        </div>
        <div style={bannerStyles.dots}>
          {slides.map((_, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: dots are visual indicators for a static list
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onMouseEnter={isSmallScreen ? undefined : () => goTo(i)}
              onClick={() => goTo(i)}
              style={
                i === active
                  ? {
                      ...bannerStyles.dot,
                      background:
                        colors[slideColorKeys[i % slideColorKeys.length]],
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
    fontSize: fontSizes.sm,
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
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    outline: 'none',
  },
  pauseIcon: {
    position: 'absolute' as const,
    bottom: '0',
    right: '0',
    fontSize: fontSizes.xs,
    lineHeight: '1',
    color: colors.textSecondary,
    opacity: '0.5',
  },
}

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
import { useEffect, useState } from 'react'
import { colors, fonts } from './theme'

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
    text: 'A collaborative ski trip planning application\nCut down on the chaos!',
  },
  {
    icon: UserPlus,
    text: 'Signup with your email, set your skiing preferences, and create or join a trip via a simple three-word code.',
  },
  {
    icon: Mountain,
    text: 'Browse hundreds of resorts from an AI-enriched catalogue, packed with detail.',
  },
  {
    icon: FileText,
    text: 'Create proposals with dates and descriptions, discuss with comments, then submit for voting.',
  },
  {
    icon: ThumbsUp,
    text: 'The Trip Coordinator runs multiple rounds of voting to arrive at a consensus.',
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

export default function InfoBanner({
  intervalMs = 4000,
  slides = defaultSlides,
}: InfoBannerProps) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, paused, slides.length])

  return (
    <section
      aria-label="Feature highlights"
      style={bannerStyles.container}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {(() => {
        const Icon = slides[active].icon
        const color = slideColors[active % slideColors.length]
        return <Icon size={20} color={color} style={bannerStyles.icon} />
      })()}
      <p
        style={{
          ...bannerStyles.text,
          color: slideColors[active % slideColors.length],
          whiteSpace: 'pre-line' as const,
        }}
      >
        {slides[active].text}
      </p>
      <div style={bannerStyles.dots}>
        {slides.map((slide, i) => (
          <button
            key={slide.text}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            style={
              i === active
                ? {
                    ...bannerStyles.dotActive,
                    background: slideColors[i % slideColors.length],
                  }
                : bannerStyles.dot
            }
          />
        ))}
        {paused && (
          <span style={bannerStyles.pauseIcon} aria-hidden="true">
            &#9646;&#9646;
          </span>
        )}
      </div>
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
  },
  text: {
    fontFamily: fonts.body,
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '4px auto 12px auto',
    minHeight: '60px',
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
    background: 'rgba(100,190,230,0.25)',
    display: 'inline-block',
    padding: '0',
    border: 'none',
    cursor: 'pointer',
  },
  dotActive: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
    padding: '0',
    border: 'none',
    cursor: 'pointer',
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

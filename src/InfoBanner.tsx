import { useEffect, useState } from 'react'
import { colors, fonts } from './theme'

const defaultSlides = [
  'A collaborative ski trip planning application\nCut down on the chaos!',
  'Signup with your email, set your skiing preferences, and create or join a trip via a simple three-word code.',
  'Browse hundreds of resorts from an AI-enriched catalogue, packed with detail.',
  'Create proposals with dates and descriptions, discuss with comments, then submit for voting.',
  'The trip coordinator runs multiple rounds of voting to arrive at a consensus.',
  'Have your say by allocating your "chips" amongst the submitted proposals.',
  'Guided "what next?" prompts stop you getting lost.',
]

interface InfoBannerProps {
  intervalMs?: number
  slides?: string[]
}

export default function InfoBanner({
  intervalMs = 3000,
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
      <p style={{ ...bannerStyles.text, whiteSpace: 'pre-line' as const }}>
        {slides[active]}
      </p>
      <div style={bannerStyles.dots}>
        {slides.map((text, i) => (
          <button
            key={text}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            style={i === active ? bannerStyles.dotActive : bannerStyles.dot}
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
    color: colors.textSecondary,
    margin: '0 auto 12px auto',
    minHeight: '60px',
    width: '80%',
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
    background: colors.accent,
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

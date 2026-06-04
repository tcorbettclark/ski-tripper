import { useCallback, useEffect, useRef, useState } from 'react'

type Visibility = 'visible' | 'hidden' | 'peek'

export default function useAutoHideFooter(): Visibility {
  const [visibility, setVisibility] = useState<Visibility>('visible')
  const scrolling = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAtBottom = useCallback(() => {
    const scrollTop = window.scrollY
    const viewportHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    return scrollTop + viewportHeight >= documentHeight - 10
  }, [])

  const handleScroll = useCallback(() => {
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
      scrollTimeout.current = null
    }

    if (isAtBottom()) {
      setVisibility('visible')
      scrolling.current = false
      return
    }

    if (!scrolling.current) {
      scrolling.current = true
      setVisibility('hidden')
    }

    scrollTimeout.current = setTimeout(() => {
      scrolling.current = false
      scrollTimeout.current = null
      setVisibility(isAtBottom() ? 'visible' : 'peek')
    }, 1500)
  }, [isAtBottom])

  useEffect(() => {
    scrolling.current = false
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
      scrollTimeout.current = null
    }
    window.scrollTo(0, 0)
    setVisibility('visible')
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
        scrollTimeout.current = null
      }
    }
  }, [handleScroll])

  return visibility
}

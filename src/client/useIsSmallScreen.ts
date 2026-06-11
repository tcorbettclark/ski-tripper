import { useEffect, useState } from 'react'

export default function useIsSmallScreen(breakpoint = 640): boolean {
  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    function handleResize() {
      setIsSmall(window.innerWidth < breakpoint)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isSmall
}

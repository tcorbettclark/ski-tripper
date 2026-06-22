import { useEffect, useState } from 'react'

function getTheme(): 'dark' | 'light' {
  return (document.documentElement.dataset.theme as 'dark' | 'light') || 'light'
}

export default function useTheme(): 'dark' | 'light' {
  const [theme, setThemeState] = useState<'dark' | 'light'>(getTheme())

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeState(getTheme())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}

export { getTheme }

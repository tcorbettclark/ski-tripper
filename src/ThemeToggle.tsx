import { Moon, Sun } from 'lucide-react'
import useTheme from './useTheme'

function setTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
  const meta = document.querySelector(
    'meta[name=color-scheme]'
  ) as HTMLMetaElement | null
  if (meta) meta.content = theme
}

export default function ThemeToggle() {
  const theme = useTheme()

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      style={styles.button}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

const styles = {
  button: {
    background: 'none',
    border: 'var(--color-bgCard) 1px solid',
    color: 'var(--color-textSecondary)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, border-color 0.15s',
  },
}

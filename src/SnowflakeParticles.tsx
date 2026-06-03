import {
  type Container,
  type ISourceOptions,
  tsParticles,
} from '@tsparticles/engine'
import { loadSnowPreset } from '@tsparticles/preset-snow'
import { useEffect, useRef, useState } from 'react'

const snowflakeOptions: ISourceOptions = {
  preset: 'snow',
  fullScreen: false,
  background: {
    color: {
      value: 'transparent',
    },
  },
  particles: {
    number: {
      value: 600,
      density: {
        enable: true,
      },
    },
    color: {
      value: '#ffffff',
    },
    opacity: {
      value: { min: 0.2, max: 0.6 },
      animation: {
        enable: true,
        speed: 0.5,
        minimumValue: 0.1,
      },
    },
    size: {
      value: { min: 1, max: 4 },
    },
    move: {
      enable: true,
      speed: 0.8,
      direction: 'bottom',
      random: true,
      straight: false,
      outModes: {
        default: 'out',
      },
    },
  },
  detectRetina: true,
}

let initPromise: Promise<void> | null = null

function ensureInit() {
  if (!initPromise) {
    initPromise = loadSnowPreset(tsParticles)
  }
  return initPromise
}

export default function SnowflakeParticles() {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Container | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let container: Container | undefined

    ensureInit().then(() => {
      if (!mountedRef.current || !containerRef.current) return
      tsParticles
        .load({
          id: 'snowflakes',
          options: snowflakeOptions,
          element: containerRef.current,
        })
        .then((c) => {
          if (!mountedRef.current) {
            c?.destroy()
            return
          }
          container = c
          instanceRef.current = c
          setReady(true)
        })
    })

    return () => {
      mountedRef.current = false
      container?.destroy()
      instanceRef.current = undefined
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {!ready && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      )}
    </div>
  )
}

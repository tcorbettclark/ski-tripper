import { colors } from './theme'

interface IconProps {
  size?: number
  color?: string
  dim?: boolean
}

const dimColor = 'rgba(100,190,230,0.14)'
const dimOpacity = 0.2

export function SkiIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Ski"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#3bbde8'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      ⛷️
    </span>
  )
}

export function SnowboardIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Snowboard"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#f0a050'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      🏂
    </span>
  )
}

export function BlackSlopeIcon({
  size = 12,
  color,
  dim,
}: Omit<IconProps, 'color'> & { color?: string; dim?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Black slope"
    >
      <polygon
        points="8,1 15,8 8,15 1,8"
        fill={dim ? dimColor : (color ?? colors.textPrimary)}
      />
    </svg>
  )
}

export function RedSlopeIcon({
  size = 12,
  color = '#e07050',
  dim,
}: Omit<IconProps, 'color'> & { color?: string; dim?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Red slope"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="2"
        fill={dim ? dimColor : color}
      />
    </svg>
  )
}

export function BlueSlopeIcon({
  size = 12,
  color = '#5090d0',
  dim,
}: Omit<IconProps, 'color'> & { color?: string; dim?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label="Blue slope"
    >
      <circle cx="8" cy="8" r="7" fill={dim ? dimColor : color} />
    </svg>
  )
}

export function OnPisteIcon({ size = 14, color, dim }: IconProps) {
  const c = dim ? dimColor : (color ?? '#3bbde8')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="On-Piste"
    >
      <rect x="4" y="8" width="10" height="7" rx="1.5" />
      <rect x="7" y="10" width="2" height="3" rx="0.5" />
      <rect x="11" y="10" width="2" height="3" rx="0.5" />
      <path d="M14 10h4l2 3v2h-6" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="12" cy="17" r="2" />
      <circle cx="18" cy="17" r="2" />
      <path d="M3 20h18" opacity="0.5" />
    </svg>
  )
}

export function OffPisteIcon({ size = 14, color, dim }: IconProps) {
  const c = dim ? dimColor : (color ?? '#c070d0')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Off-Piste"
    >
      <path d="M3 21c1.5-2 3-6 5-7s2 3 4 2 2-5 4-6 2 2 4 1 2-4 3-5" />
      <path d="M9 8c0-2 1-4 3-5" strokeWidth="1" opacity="0.6" />
      <path d="M7 4l1.5 1" strokeWidth="1" opacity="0.6" />
      <path d="M13 2l0.5 1.5" strokeWidth="1" opacity="0.6" />
      <path d="M10 3l0.5 1" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

export function FiveStarHotelIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="5-star hotel"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#e0a040'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      🏛️
    </span>
  )
}

export function HotelIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Hotel"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#50b080'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      🏨
    </span>
  )
}

export function ChaletIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Chalet"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#7090d0'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      🏡
    </span>
  )
}

export function GuesthouseIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Guesthouse"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#a08860'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      🛏️
    </span>
  )
}

export function SnowflakeIcon({ size = 14, color, dim }: IconProps) {
  return (
    <span
      role="img"
      aria-label="Snow quality"
      style={{
        fontSize: size,
        lineHeight: 1,
        color: dim ? dimColor : (color ?? '#b0d8f0'),
        filter: dim ? 'grayscale(1)' : undefined,
        opacity: dim ? dimOpacity : undefined,
      }}
    >
      ❄️
    </span>
  )
}

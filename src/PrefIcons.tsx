interface IconProps {
  size?: number
  color?: string
  dim?: boolean
}

const dimColor = 'rgba(100,190,230,0.14)'
const dimOpacity = 0.2

function emojiStyle(size: number, color: string, dim: boolean | undefined) {
  return {
    fontSize: size,
    lineHeight: 1,
    color: dim ? dimColor : color,
    filter: dim ? 'grayscale(1)' : undefined,
    opacity: dim ? dimOpacity : undefined,
  }
}

function EmojiIcon({
  size = 14,
  color,
  dim,
  label,
  children,
}: IconProps & { label: string; children: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      style={emojiStyle(size, color ?? '#3bbde8', dim)}
    >
      {children}
    </span>
  )
}

export function SkiIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon size={size} color={color ?? '#3bbde8'} dim={dim} label="Ski">
      ⛷️
    </EmojiIcon>
  )
}

export function SnowboardIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? '#f0a050'}
      dim={dim}
      label="Snowboard"
    >
      🏂
    </EmojiIcon>
  )
}

export function BlackSlopeIcon({ size = 12, color, dim }: IconProps) {
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
        fill={dim ? dimColor : (color ?? '#404040')}
        stroke={dim ? 'none' : '#edf6fc'}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function RedSlopeIcon({ size = 12, color = '#c40000', dim }: IconProps) {
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
  color = '#0055a4',
  dim,
}: IconProps) {
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
  const c = dim ? dimColor : (color ?? '#d4a017')
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
    <EmojiIcon
      size={size}
      color={color ?? '#e0a040'}
      dim={dim}
      label="5-star hotel"
    >
      🏛️
    </EmojiIcon>
  )
}

export function HotelIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon size={size} color={color ?? '#50b080'} dim={dim} label="Hotel">
      🏨
    </EmojiIcon>
  )
}

export function ChaletIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon size={size} color={color ?? '#7090d0'} dim={dim} label="Chalet">
      🏡
    </EmojiIcon>
  )
}

export function GuesthouseIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? '#a08860'}
      dim={dim}
      label="Guesthouse"
    >
      🛏️
    </EmojiIcon>
  )
}

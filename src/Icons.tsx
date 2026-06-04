import { colors, mix } from './theme'

interface IconProps {
  size?: number
  color?: string
  dim?: boolean
}

const dimColor = mix('--color-textSecondary', 0.14)
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
      style={emojiStyle(size, color ?? colors.accent, dim)}
    >
      {children}
    </span>
  )
}

export function SkiIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon size={size} color={color ?? colors.accent} dim={dim} label="Ski">
      ⛷️
    </EmojiIcon>
  )
}

export function SnowboardIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? colors.snowboard}
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
        fill={dim ? dimColor : (color ?? colors.slopeBlack)}
        stroke={dim ? 'none' : colors.textPrimary}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function RedSlopeIcon({
  size = 12,
  color = colors.slopeRed,
  dim,
}: IconProps) {
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
  color = colors.slopeBlue,
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
  const c = dim ? dimColor : (color ?? colors.onPiste)
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
  const c = dim ? dimColor : (color ?? colors.offPiste)
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
      color={color ?? colors.hotel5Star}
      dim={dim}
      label="5-star hotel"
    >
      🏛️
    </EmojiIcon>
  )
}

export function HotelIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? colors.hotel}
      dim={dim}
      label="Hotel"
    >
      🏨
    </EmojiIcon>
  )
}

export function ChaletIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? colors.chalet}
      dim={dim}
      label="Chalet"
    >
      🏡
    </EmojiIcon>
  )
}

export function GuesthouseIcon({ size = 14, color, dim }: IconProps) {
  return (
    <EmojiIcon
      size={size}
      color={color ?? colors.guesthouse}
      dim={dim}
      label="Guesthouse"
    >
      🛏️
    </EmojiIcon>
  )
}

export function HamburgerIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="Menu"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      ☰️
    </span>
  )
}

export function BrandTitle({
  fontSize,
  style,
}: {
  fontSize: string | number
  style?: React.CSSProperties
}) {
  return (
    <span
      role="img"
      aria-label="Ski Tripper"
      style={{
        fontSize,
        lineHeight: 1,
        fontVariantEmoji: 'text',
        letterSpacing: '0.5em',
        ...style,
      }}
    >
      ⛷︎ SKI TRIPPER
    </span>
  )
}

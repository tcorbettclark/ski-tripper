export const colors = {
  accent: 'var(--color-accent)',
  bgPrimary: 'var(--color-bgPrimary)',
  bgCard: 'var(--color-bgCard)',
  bgInput: 'var(--color-bgInput)',
  textPrimary: 'var(--color-textPrimary)',
  textSecondary: 'var(--color-textSecondary)',
  textData: 'var(--color-textData)',
  error: 'var(--color-error)',
  pisteBeginner: 'var(--color-pisteBeginner)',
  pisteIntermediate: 'var(--color-pisteIntermediate)',
  pisteAdvanced: 'var(--color-pisteAdvanced)',
  timeEating: 'var(--color-timeEating)',
  timeApres: 'var(--color-timeApres)',
  timeHotel: 'var(--color-timeHotel)',
  snowboard: 'var(--color-snowboard)',
  slopeBlack: 'var(--color-slopeBlack)',
  slopeRed: 'var(--color-slopeRed)',
  slopeBlue: 'var(--color-slopeBlue)',
  onPiste: 'var(--color-onPiste)',
  offPiste: 'var(--color-offPiste)',
  hotel5Star: 'var(--color-hotel5Star)',
  hotel: 'var(--color-hotel)',
  chalet: 'var(--color-chalet)',
  guesthouse: 'var(--color-guesthouse)',
  slide0: 'var(--color-slide0)',
  slide1: 'var(--color-slide1)',
  slide2: 'var(--color-slide2)',
  slide3: 'var(--color-slide3)',
  slide4: 'var(--color-slide4)',
  slide5: 'var(--color-slide5)',
  slide6: 'var(--color-slide6)',
  slide7: 'var(--color-slide7)',
}

export function mix(token: string, opacity: number): string {
  return `color-mix(in srgb, var(${token}) ${opacity * 100}%, transparent)`
}

export const fontSizes = {
  xs: '12px',
  sm: '13px',
  base: '14px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '30px',
  '3xl': '40px',
} as const

export const fonts = {
  body: "'DM Sans', sans-serif",
  display: "'Cormorant Garamond', Georgia, serif",
  mono: 'monospace',
}

export const borders = {
  subtle: `1px solid ${mix('--color-textSecondary', 0.3)}`,
  card: `1px solid ${mix('--color-accent', 0.14)}`,
  muted: `1px solid ${mix('--color-accent', 0.18)}`,
  accent: `1px solid ${mix('--color-accent', 0.3)}`,
}

export const formStyles = {
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    margin: 0,
  },
  primaryButton: {
    marginTop: '4px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
  cancelButton: {
    padding: '10px 16px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    cursor: 'pointer',
  },
  saveButton: {
    padding: '10px 24px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: '600',
    cursor: 'pointer',
  },
}

export const authStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(160deg, var(--color-bgPrimary) 0%, var(--color-bgCard) 50%, var(--color-bgPrimary) 100%)',
    padding: '24px',
  },
  card: {
    position: 'relative' as const,
    zIndex: 1,
    background: colors.bgCard,
    borderRadius: '16px',
    padding: '48px 44px',
    width: '100%',
    maxWidth: '420px',
    border: borders.card,
    boxShadow: `0 24px 80px var(--color-shadow), 0 0 0 1px ${mix('--color-accent', 0.04)}`,
  },
  brandName: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '500',
    letterSpacing: '0.45em',
    color: colors.accent,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontFamily: fonts.display,
    marginBottom: '32px',
    fontSize: fontSizes['3xl'],
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: '1.1',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  switchText: {
    marginTop: '28px',
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: colors.accent,
    fontFamily: fonts.body,
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: fontSizes.sm,
    padding: '0',
  },
}

export const detailStyles = {
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    fontWeight: '600',
    color: colors.textPrimary,
    margin: 0,
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: '6px',
  },
  websiteLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  descriptionText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textData,
    lineHeight: '1.6',
    margin: '4px 0 0',
    whiteSpace: 'pre-line' as const,
  },
} as const

export const fieldStyles = {
  default: {
    field: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '7px',
    },
    label: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      fontWeight: '500',
      color: colors.textSecondary,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    input: {
      height: '40px',
      padding: '10px 14px',
      borderRadius: '7px',
      border: borders.card,
      background: colors.bgInput,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      outline: 'none' as const,
    },
  },
  auth: {
    field: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
      textAlign: 'left' as const,
    },
    label: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      fontWeight: '500',
      color: colors.textSecondary,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    input: {
      padding: '12px 16px',
      borderRadius: '8px',
      border: borders.card,
      background: colors.bgInput,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      outline: 'none' as const,
    },
  },
}

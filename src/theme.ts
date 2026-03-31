export const colors = {
  accent: '#3bbde8',
  bgPrimary: '#07111f',
  bgCard: '#0d1e30',
  bgInput: '#060f1b',
  textPrimary: '#edf6fc',
  textSecondary: '#6a94ae',
  textData: '#b0cedf',
  error: '#ff6b6b',
}

export const fonts = {
  body: "'DM Sans', sans-serif",
  display: "'Cormorant Garamond', Georgia, serif",
  mono: 'monospace',
}

export const borders = {
  subtle: '1px solid rgba(100,190,230,0.1)',
  card: '1px solid rgba(100,190,230,0.12)',
  muted: '1px solid rgba(100,190,230,0.15)',
  accent: '1px solid rgba(59,189,232,0.3)',
}

export const formStyles = {
  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: '13px',
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
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  cancelButton: {
    padding: '10px 16px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: '14px',
    cursor: 'pointer',
  },
  saveButton: {
    padding: '10px 24px',
    borderRadius: '7px',
    border: 'none',
    background: colors.accent,
    color: colors.bgPrimary,
    fontFamily: fonts.body,
    fontSize: '14px',
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
      'linear-gradient(160deg, #040c18 0%, #081626 35%, #0c1e32 65%, #07111f 100%)',
    padding: '24px',
  },
  card: {
    background: colors.bgCard,
    borderRadius: '16px',
    padding: '48px 44px',
    width: '100%',
    maxWidth: '420px',
    border: borders.card,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,189,232,0.04)',
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '0.14em',
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: '14px',
  },
  title: {
    fontFamily: fonts.display,
    marginBottom: '32px',
    fontSize: '38px',
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
    fontSize: '13px',
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
    fontSize: '13px',
    padding: '0',
  },
}

export const fieldStyles = {
  default: {
    field: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '7px',
    },
    label: {
      fontFamily: fonts.body,
      fontSize: '11px',
      fontWeight: '500',
      color: colors.textSecondary,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    },
    input: {
      padding: '10px 14px',
      borderRadius: '7px',
      border: borders.card,
      background: colors.bgInput,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: '14px',
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
      fontSize: '11px',
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
      fontSize: '15px',
      outline: 'none' as const,
    },
  },
}

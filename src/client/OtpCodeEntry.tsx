import { useState } from 'react'
import {
  authWithOtp as _authWithOtp,
  requestOtp as _requestOtp,
} from './backend'
import Field from './Field'
import ThemeToggle from './ThemeToggle'
import { authStyles, colors, fontSizes, fonts, formStyles } from './theme'
import { toast } from './toast'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'

interface OtpCodeEntryProps {
  email: string
  otpId: string
  onSuccess: (record: Record<string, unknown>) => void
  onBack: () => void
  requestOtp?: (email: string) => Promise<{ otpId: string }>
  authWithOtp?: (otpId: string, otp: string) => Promise<Record<string, unknown>>
}

export default function OtpCodeEntry({
  email,
  otpId: initialOtpId,
  onSuccess,
  onBack,
  requestOtp = _requestOtp,
  authWithOtp = _authWithOtp,
}: OtpCodeEntryProps) {
  const isSmall = useIsSmallScreen()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentOtpId, setCurrentOtpId] = useState(initialOtpId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const record = await authWithOtp(currentOtpId, code)
      onSuccess(record)
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setLoading(true)
    try {
      const result = await requestOtp(email)
      setCurrentOtpId(result.otpId)
      toast('Verification code resent!', 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        ...authStyles.container,
        flexDirection: 'column',
        position: 'relative',
        padding: isSmall ? '16px' : '24px',
      }}
    >
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2 }}>
        <ThemeToggle />
      </div>
      <div
        style={{
          ...authStyles.card,
          padding: isSmall ? '28px 20px' : '48px 44px',
        }}
      >
        <h1 style={authStyles.title}>Enter verification code</h1>
        <p style={otpStyles.message}>We sent a verification code to</p>
        <p style={otpStyles.email}>{email}</p>
        <p style={otpStyles.followUp}>Enter the code below to continue.</p>
        <form onSubmit={handleSubmit} style={authStyles.form}>
          <Field
            label="Verification code"
            name="otp"
            data-testid="otp-code"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="12345678"
            variant="auth"
          />
          <button
            type="submit"
            disabled={loading}
            style={formStyles.primaryButton}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <button
          type="button"
          data-testid="resend-otp"
          disabled={loading}
          onClick={handleResend}
          style={{
            ...authStyles.switchLink,
            opacity: loading ? 0.6 : 1,
            marginTop: '12px',
          }}
        >
          Resend code
        </button>
        <p style={authStyles.switchText}>
          <button type="button" onClick={onBack} style={authStyles.switchLink}>
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}

const otpStyles = {
  email: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    fontWeight: 'bold' as const,
    color: colors.textPrimary,
    textAlign: 'center' as const,
    margin: '8px 0',
  },
  message: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0',
  },
  followUp: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  },
}

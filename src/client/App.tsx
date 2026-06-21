import { Info } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Participant,
  Preferences,
  ResortWithEmbedding,
  Trip,
} from '../shared/types.d'
import AboutPopup from './AboutPopup'
import AuthForm from './AuthForm'
import {
  createPreferences as _createPreferences,
  fetchResortDataWithAuth as _fetchResortDataWithAuth,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getPreferences as _getPreferences,
  hasSession as _hasSession,
  listParticipatedTrips as _listParticipatedTrips,
  listPolls as _listPolls,
  listTripParticipants as _listTripParticipants,
  listTrips as _listTrips,
  updateName as _updateName,
  updateTrip as _updateTrip,
  getPb,
} from './backend'
import ConfirmEmailChangeScreen from './ConfirmEmailChangeScreen'
import EmailVerifyScreen from './EmailVerifyScreen'
import ErrorBoundary from './ErrorBoundary'
import Footer from './Footer'
import ForgotPasswordForm from './ForgotPasswordForm'
import Header from './Header'
import Overview from './Overview'
import Poll from './Poll'
import PreferencesForm from './PreferencesForm'
import PreferencesModal from './PreferencesModal'
import Proposals from './Proposals'
import type { StatusFilter } from './ProposalsGrid'
import ResetPasswordForm from './ResetPasswordForm'
import Resorts from './Resorts'
import Trips from './Trips'
import { colors, fontSizes, fonts, mix } from './theme'
import useAuth from './useAuth'
import { getErrorMessage } from './utils'

interface ListTripsResult {
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}

interface AppProps {
  useAuthHook?: typeof useAuth
  useIsSmallScreenHook?: () => boolean
  useAutoHideFooterHook?: () => 'visible' | 'hidden'
  hasSession?: () => boolean
  confirmVerification?: (token: string) => Promise<unknown>
  listTrips?: (userId: string) => Promise<ListTripsResult>
  listParticipatedTrips?: (userId: string) => Promise<{
    trips: Trip[]
  }>
  listPolls?: (
    tripId: string,
    userId: string
  ) => Promise<{
    polls: Array<{ state: string; endDate: string }>
  }>
  getCoordinatorParticipant?: (tripId: string) => Promise<{
    participants: Array<{
      user: string
      userName: string
    }>
  }>
  getPreferences?: (userId: string) => Promise<Preferences | null>
  createPreferences?: (
    userId: string,
    data: Omit<Preferences, 'id' | 'created' | 'updated' | 'user'>
  ) => Promise<Preferences>
  updateTrip?: (
    tripId: string,
    data: Partial<Trip>,
    userId: string
  ) => Promise<Trip>
  confirmPasswordReset?: (
    token: string,
    password: string,
    passwordConfirm: string
  ) => Promise<unknown>
  fetchResortDataWithAuth?: () => Promise<string>
  updateName?: (name: string) => Promise<unknown>
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
}

const defaultConfirmVerification = (token: string) =>
  getPb().collection('users').confirmVerification(token)
const defaultListTrips = _listTrips
const defaultListParticipatedTrips = _listParticipatedTrips
const defaultListPolls = _listPolls
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant
const defaultGetPreferences = _getPreferences
const defaultCreatePreferences = _createPreferences
const defaultUpdateTrip = _updateTrip
const defaultConfirmPasswordReset = (
  token: string,
  password: string,
  passwordConfirm: string
) =>
  getPb()
    .collection('users')
    .confirmPasswordReset(token, password, passwordConfirm)
const defaultFetchResortDataWithAuth = _fetchResortDataWithAuth
const defaultUpdateName = _updateName
const defaultListTripParticipants = _listTripParticipants

type TripDetailTab = 'overview' | 'resorts' | 'proposals' | 'poll'

type ProposalDetail = {
  proposalId: string
  subTab: 'proposal' | 'accommodations' | 'discussion'
}

export default function App({
  useAuthHook = useAuth,
  useIsSmallScreenHook,
  useAutoHideFooterHook,
  hasSession = _hasSession,
  confirmVerification = defaultConfirmVerification,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listPolls = defaultListPolls,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant,
  getPreferences = defaultGetPreferences,
  createPreferences = defaultCreatePreferences,
  updateTrip = defaultUpdateTrip,
  confirmPasswordReset = defaultConfirmPasswordReset,
  fetchResortDataWithAuth = defaultFetchResortDataWithAuth,
  updateName = defaultUpdateName,
  listTripParticipants = defaultListTripParticipants,
}: AppProps) {
  const {
    user,
    checking,
    sessionExpiredMessage,
    login,
    logout,
    onAuthError,
    refreshUser,
  } = useAuthHook({ hasSession })
  const [page, setPage] = useState<'login' | 'signup' | 'forgotPassword'>(
    'login'
  )
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(
    null
  )
  const [emailChangeToken, setEmailChangeToken] = useState<string | null>(null)
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)
  const [view, setView] = useState<'tripList' | 'tripDetail'>('tripList')
  const [tripDetailTab, setTripDetailTab] = useState<TripDetailTab>('overview')
  const [proposalsStatusFilter, setProposalsStatusFilter] =
    useState<StatusFilter>('DRAFT')
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(
    null
  )
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [preferencesUpdated, setPreferencesUpdated] = useState<{
    userId: string
    preferences: Preferences
  } | null>(null)
  const [checkingPreferences, setCheckingPreferences] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [activePollEndDate, setActivePollEndDate] = useState<string | null>(
    null
  )
  const [resorts, setResorts] = useState<ResortWithEmbedding[]>([])
  const [aboutOpen, setAboutOpen] = useState(false)
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    if (!user) return
    fetchResortDataWithAuth()
      .then((text) => {
        if (!text.trim()) {
          setResorts([])
          return
        }
        const parsed = text
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as ResortWithEmbedding)
        setResorts(parsed)
      })
      .catch(() => setResorts([]))
  }, [user, fetchResortDataWithAuth])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return
    if (window.location.pathname === '/reset-password') {
      setResetPasswordToken(token)
      setPasswordResetSuccess(false)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (window.location.pathname === '/verify') {
      confirmVerification(token)
        .then(() => {
          window.history.replaceState({}, '', '/')
          refreshUser()
        })
        .catch(() => {
          window.history.replaceState({}, '', '/')
        })
      return
    }
    if (window.location.pathname === '/confirm-email') {
      setEmailChangeToken(token)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [confirmVerification, refreshUser])

  const loadTrips = useCallback(
    (userId: string) => {
      Promise.all([listTrips(userId), listParticipatedTrips(userId)]).then(
        ([ownRes, participatedRes]) => {
          const coordinatedIds = new Set(
            ownRes.trips.map((t: { id: string }) => t.id)
          )
          const allTrips = [
            ...ownRes.trips,
            ...participatedRes.trips.filter(
              (t: { id: string }) => !coordinatedIds.has(t.id)
            ),
          ]
          setTrips(allTrips)
        }
      )
    },
    [listTrips, listParticipatedTrips]
  )

  const handleJoinedTrip = useCallback(() => {
    if (!user) return
    loadTrips(user.id)
    setRefreshProposalsKey((k) => k + 1)
  }, [user, loadTrips])

  const preferencesFetchedRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setPreferences(null)
      preferencesFetchedRef.current = false
      return
    }
    if (preferencesFetchedRef.current) return
    preferencesFetchedRef.current = true
    setCheckingPreferences(true)
    getPreferences(user.id)
      .then((prefs) => {
        setPreferences(prefs)
      })
      .catch(() => setPreferences(null))
      .finally(() => setCheckingPreferences(false))
  }, [user, getPreferences])

  useEffect(() => {
    if (!user) return
    loadTrips(user.id)
  }, [user, loadTrips])

  useEffect(() => {
    if (trips.length !== 1 || !user || autoSelectedRef.current) return
    if (view === 'tripList') {
      autoSelectedRef.current = true
      const trip = trips[0]
      setSelectedTripId(trip.id)
      setTripDetailTab('overview')
      listPolls(trip.id, user.id).then(({ polls }) => {
        const open = polls.find((p) => p.state === 'OPEN')
        setActivePollEndDate(open?.endDate || null)
      })
      setView('tripDetail')
    }
  }, [trips, user, view, listPolls])

  async function handleLogout() {
    setLogoutError(null)
    try {
      getPb().authStore.clear()
      logout()
      setPage('login')
    } catch (err) {
      setLogoutError(getErrorMessage(err))
    }
  }

  function handleSelectTrip(tripId: string) {
    if (!user) return
    setSelectedTripId(tripId)
    setView('tripDetail')
    setTripDetailTab('overview')
    setProposalsStatusFilter('DRAFT')
    setProposalDetail(null)
    listPolls(tripId, user.id).then(({ polls }) => {
      const open = polls.find((p) => p.state === 'OPEN')
      setActivePollEndDate(open?.endDate || null)
    })
  }

  function handleViewAllTrips() {
    setView('tripList')
    setSelectedTripId(null)
    setTripDetailTab('overview')
    setProposalsStatusFilter('DRAFT')
    setProposalDetail(null)
    setActivePollEndDate(null)
  }

  function handleActivePollChange(endDate: string | null) {
    setActivePollEndDate(endDate)
  }

  function handleTripUpdated(updatedTrip: Trip) {
    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    )
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null

  if (checking) return null

  if (!user) {
    const aboutButton = (
      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 2,
          background: 'none',
          border: 'none',
          color: colors.textSecondary,
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          lineHeight: 1,
        }}
        aria-label="About Ski Tripper"
      >
        <Info size={14} />
        About
      </button>
    )
    if (resetPasswordToken) {
      return (
        <>
          {aboutButton}
          <ResetPasswordForm
            token={resetPasswordToken}
            onSuccess={() => {
              setResetPasswordToken(null)
              setPasswordResetSuccess(true)
              setPage('login')
            }}
            confirmPasswordReset={confirmPasswordReset}
          />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutPopup open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </>
      )
    }
    if (emailChangeToken) {
      return (
        <>
          {aboutButton}
          <ConfirmEmailChangeScreen
            token={emailChangeToken}
            onSuccess={() => {
              setEmailChangeToken(null)
              setPage('login')
            }}
            onBackToLogin={() => {
              setEmailChangeToken(null)
              setPage('login')
            }}
          />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutPopup open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </>
      )
    }
    if (page === 'forgotPassword') {
      return (
        <>
          {aboutButton}
          <ForgotPasswordForm onBackToLogin={() => setPage('login')} />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutPopup open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </>
      )
    }
    return (
      <>
        {aboutButton}
        <AuthForm
          mode={page as 'login' | 'signup'}
          onSuccess={login}
          onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
          onForgotPassword={() => setPage('forgotPassword')}
          sessionExpiredMessage={
            passwordResetSuccess
              ? 'Password reset successful. Please sign in with your new password.'
              : sessionExpiredMessage
          }
        />
        <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
        <AboutPopup open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </>
    )
  }

  if (!user.emailVerification) {
    return (
      <EmailVerifyScreen
        email={user.email}
        onBackToLogin={handleLogout}
        requestVerification={(email: string) =>
          getPb().collection('users').requestVerification(email)
        }
      />
    )
  }

  if (checkingPreferences) return null

  if (!preferences) {
    return (
      <div
        style={{
          fontFamily: fonts.body,
          background: colors.bgPrimary,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: colors.bgCard,
            border: `1px solid ${mix('--color-textSecondary', 0.12)}`,
            borderRadius: '16px',
            padding: '48px 44px',
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <h2
            style={{
              fontFamily: fonts.display,
              fontSize: fontSizes['2xl'],
              fontWeight: '600',
              color: colors.textPrimary,
              marginBottom: '8px',
              marginTop: 0,
            }}
          >
            Welcome! Set your preferences
          </h2>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: fontSizes.base,
              color: colors.textSecondary,
              marginBottom: '32px',
            }}
          >
            Tell us about your ideal ski trip so we can personalise your
            experience.
          </p>
          <PreferencesForm
            userId={user.id}
            onSaved={(prefs) => {
              setPreferences(prefs)
              setView('tripList')
              setSelectedTripId(null)
            }}
            createPreferences={createPreferences}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        fontFamily: fonts.body,
        background: colors.bgPrimary,
        minHeight: '100vh',
      }}
    >
      <Header
        view={view}
        tripDetailTab={tripDetailTab}
        onViewAllTrips={handleViewAllTrips}
        onTripDetailTabChange={(tab) => {
          setTripDetailTab(tab as TripDetailTab)
          if (tab !== 'proposals') {
            setProposalsStatusFilter('DRAFT')
            setProposalDetail(null)
          }
        }}
        userName={user.name || user.email}
        onLogout={handleLogout}
        logoutError={logoutError}
        onOpenPreferences={() => setShowPreferencesModal(true)}
        activePollEndDate={activePollEndDate}
        useIsSmallScreenHook={useIsSmallScreenHook}
      />

      {view === 'tripList' &&
        !(trips.length === 1 && !autoSelectedRef.current) && (
          <ErrorBoundary>
            <Trips
              user={user}
              trips={trips}
              onSelectTrip={handleSelectTrip}
              onJoinedTrip={handleJoinedTrip}
              getCoordinatorParticipant={getCoordinatorParticipant}
            />
          </ErrorBoundary>
        )}

      {view === 'tripDetail' && selectedTripId && selectedTrip && (
        <>
          {tripDetailTab === 'overview' && (
            <ErrorBoundary>
              <Overview
                user={user}
                trip={selectedTrip}
                tripId={selectedTripId}
                resorts={resorts}
                onNavigateToTab={(tab, statusFilter, detail) => {
                  setTripDetailTab(tab as TripDetailTab)
                  if (tab === 'proposals' && statusFilter) {
                    setProposalsStatusFilter(statusFilter)
                  }
                  if (detail) {
                    setProposalDetail(detail)
                  }
                }}
                onTripUpdated={handleTripUpdated}
                onAuthError={onAuthError}
                updateTrip={updateTrip}
                preferencesUpdated={preferencesUpdated}
                onOpenPreferences={() => setShowPreferencesModal(true)}
                listTripParticipants={listTripParticipants}
              />
            </ErrorBoundary>
          )}
          {tripDetailTab === 'resorts' && (
            <ErrorBoundary>
              <Resorts
                user={user}
                tripId={selectedTripId}
                resorts={resorts}
                onNavigateToProposals={() => setTripDetailTab('proposals')}
                onAuthError={onAuthError}
              />
            </ErrorBoundary>
          )}
          {tripDetailTab === 'proposals' && (
            <ErrorBoundary>
              <Proposals
                user={user}
                tripId={selectedTripId}
                key={refreshProposalsKey}
                resorts={resorts}
                statusFilter={proposalsStatusFilter}
                onStatusFilterChange={setProposalsStatusFilter}
                proposalDetail={proposalDetail ?? undefined}
                onRefresh={() => setRefreshProposalsKey((k) => k + 1)}
                onAuthError={onAuthError}
              />
            </ErrorBoundary>
          )}
          {tripDetailTab === 'poll' && (
            <ErrorBoundary>
              <Poll
                user={user}
                tripId={selectedTripId}
                onActivePollChange={handleActivePollChange}
                onAuthError={onAuthError}
              />
            </ErrorBoundary>
          )}
        </>
      )}

      <PreferencesModal
        userId={user.id}
        userName={user.name || user.email}
        initial={preferences}
        open={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onSaved={(prefs) => {
          setPreferences(prefs)
          setPreferencesUpdated({ userId: user.id, preferences: prefs })
        }}
        onNameUpdated={() => {
          refreshUser()
        }}
        createPreferences={createPreferences}
        updateName={updateName}
      />
      <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
    </div>
  )
}

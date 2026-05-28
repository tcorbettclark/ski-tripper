import type { Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import AuthForm from './AuthForm'
import {
  account as _account,
  createPreferences as _createPreferences,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getPreferences as _getPreferences,
  hasSession as _hasSession,
  listParticipatedTrips as _listParticipatedTrips,
  listPolls as _listPolls,
  listResorts as _listResorts,
  listTrips as _listTrips,
  updateTrip as _updateTrip,
} from './backend'
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
import { colors, fonts } from './theme'
import type { Preferences, Resort, Trip } from './types.d.ts'
import useAuth from './useAuth'

interface ListTripsResult {
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}

interface AppProps {
  hasSession?: () => boolean
  accountGet?: () => Promise<Models.User>
  deleteSession?: () => Promise<unknown>
  updateEmailVerification?: (userId: string, secret: string) => Promise<unknown>
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
      participantUserId: string
      participantUserName: string
    }>
  }>
  getPreferences?: (userId: string) => Promise<Preferences | null>
  createPreferences?: (
    userId: string,
    data: Omit<Preferences, '$id' | '$createdAt' | '$updatedAt' | 'userId'>
  ) => Promise<Preferences>
  listResorts?: () => Promise<{ resorts: Resort[] }>
  updateTrip?: (
    tripId: string,
    data: Partial<Trip>,
    participantUserId: string
  ) => Promise<Trip>
  updateRecovery?: (
    userId: string,
    secret: string,
    password: string
  ) => Promise<unknown>
}

const defaultAccountGet = () => _account.get()
const defaultDeleteSession = () => _account.deleteSession('current')
const defaultUpdateEmailVerification = (userId: string, secret: string) =>
  _account.updateVerification(userId, secret)
const defaultListTrips = _listTrips
const defaultListParticipatedTrips = _listParticipatedTrips
const defaultListPolls = _listPolls
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant
const defaultGetPreferences = _getPreferences
const defaultCreatePreferences = _createPreferences
const defaultListResorts = _listResorts
const defaultUpdateTrip = _updateTrip
const defaultUpdateRecovery = (
  userId: string,
  secret: string,
  password: string
) => _account.updateRecovery(userId, secret, password)

type TripDetailTab = 'overview' | 'resorts' | 'proposals' | 'poll'

export default function App({
  hasSession = _hasSession,
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession,
  updateEmailVerification = defaultUpdateEmailVerification,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listPolls = defaultListPolls,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant,
  getPreferences = defaultGetPreferences,
  createPreferences = defaultCreatePreferences,
  listResorts = defaultListResorts,
  updateTrip = defaultUpdateTrip,
  updateRecovery = defaultUpdateRecovery,
}: AppProps) {
  const {
    user,
    checking,
    sessionExpiredMessage,
    login,
    logout,
    onAuthError,
    refreshUser,
  } = useAuth({ hasSession, accountGet, deleteSession })
  const [page, setPage] = useState<'login' | 'signup' | 'forgotPassword'>(
    'login'
  )
  const [resetPassword, setResetPassword] = useState<{
    userId: string
    secret: string
  } | null>(null)
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)
  const [view, setView] = useState<'tripList' | 'tripDetail'>('tripList')
  const [tripDetailTab, setTripDetailTab] = useState<TripDetailTab>('overview')
  // Lifted from ProposalsGrid so that NextActions can navigate directly to a specific proposals sub-tab.
  // Without this, navigating to the proposals tab always lands on DRAFT regardless of context.
  const [proposalsStatusFilter, setProposalsStatusFilter] =
    useState<StatusFilter>('DRAFT')
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
  const [resorts, setResorts] = useState<Resort[]>([])
  const autoSelectedRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifyUserId = params.get('userId')
    const verifySecret = params.get('secret')
    if (!verifyUserId || !verifySecret) return
    if (window.location.pathname === '/reset-password') {
      setResetPassword({ userId: verifyUserId, secret: verifySecret })
      setPasswordResetSuccess(false)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    updateEmailVerification(verifyUserId, verifySecret)
      .then(() => {
        window.history.replaceState({}, '', window.location.pathname)
        refreshUser()
      })
      .catch(() => {})
  }, [updateEmailVerification, refreshUser])

  const loadTrips = useCallback(
    (userId: string) => {
      Promise.all([listTrips(userId), listParticipatedTrips(userId)]).then(
        ([ownRes, participatedRes]) => {
          const coordinatedIds = new Set(
            ownRes.trips.map((t: { $id: string }) => t.$id)
          )
          const allTrips = [
            ...ownRes.trips,
            ...participatedRes.trips.filter(
              (t: { $id: string }) => !coordinatedIds.has(t.$id)
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
    loadTrips(user.$id)
    setRefreshProposalsKey((k) => k + 1)
  }, [user, loadTrips])

  useEffect(() => {
    if (!user) {
      setPreferences(null)
      return
    }
    setCheckingPreferences(true)
    getPreferences(user.$id)
      .then((prefs) => {
        setPreferences(prefs)
      })
      .catch(() => setPreferences(null))
      .finally(() => setCheckingPreferences(false))
  }, [user, getPreferences])

  useEffect(() => {
    if (!user) return
    loadTrips(user.$id)
  }, [user, loadTrips])

  useEffect(() => {
    if (!selectedTripId) {
      setResorts([])
      return
    }
    listResorts()
      .then((result) => setResorts(result.resorts))
      .catch(() => {})
  }, [selectedTripId, listResorts])

  useEffect(() => {
    if (trips.length !== 1 || !user || autoSelectedRef.current) return
    if (view === 'tripList') {
      autoSelectedRef.current = true
      const trip = trips[0]
      setSelectedTripId(trip.$id)
      setTripDetailTab('overview')
      listPolls(trip.$id, user.$id).then(({ polls }) => {
        const open = polls.find((p) => p.state === 'OPEN')
        setActivePollEndDate(open?.endDate || null)
      })
      setView('tripDetail')
    }
  }, [trips, user, view, listPolls])

  async function handleLogout() {
    setLogoutError(null)
    try {
      await deleteSession()
      logout()
      setPage('login')
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleSelectTrip(tripId: string) {
    if (!user) return
    setSelectedTripId(tripId)
    setView('tripDetail')
    setTripDetailTab('overview')
    setProposalsStatusFilter('DRAFT')
    listPolls(tripId, user.$id).then(({ polls }) => {
      const open = polls.find((p) => p.state === 'OPEN')
      setActivePollEndDate(open?.endDate || null)
    })
  }

  function handleViewAllTrips() {
    setView('tripList')
    setSelectedTripId(null)
    setTripDetailTab('overview')
    setProposalsStatusFilter('DRAFT')
    setActivePollEndDate(null)
  }

  function handleActivePollChange(endDate: string | null) {
    setActivePollEndDate(endDate)
  }

  function handleTripUpdated(updatedTrip: Trip) {
    setTrips((prev) =>
      prev.map((t) => (t.$id === updatedTrip.$id ? updatedTrip : t))
    )
  }

  const selectedTrip = trips.find((t) => t.$id === selectedTripId) || null

  if (checking) return null

  if (!user) {
    if (resetPassword) {
      return (
        <>
          <ResetPasswordForm
            userId={resetPassword.userId}
            secret={resetPassword.secret}
            onSuccess={() => {
              setResetPassword(null)
              setPasswordResetSuccess(true)
              setPage('login')
            }}
            updateRecovery={updateRecovery}
          />
          <Footer />
        </>
      )
    }
    if (page === 'forgotPassword') {
      return (
        <>
          <ForgotPasswordForm onBackToLogin={() => setPage('login')} />
          <Footer />
        </>
      )
    }
    return (
      <>
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
        <Footer />
      </>
    )
  }

  if (!user.emailVerification) {
    return (
      <EmailVerifyScreen
        email={user.email}
        onBackToLogin={handleLogout}
        createEmailVerification={(url: string) =>
          _account.createVerification(url)
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
            border: '1px solid rgba(100,190,230,0.12)',
            borderRadius: '16px',
            padding: '48px 44px',
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <h2
            style={{
              fontFamily: fonts.display,
              fontSize: '28px',
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
              fontSize: '14px',
              color: colors.textSecondary,
              marginBottom: '32px',
            }}
          >
            Tell us about your ideal ski trip so we can personalise your
            experience.
          </p>
          <PreferencesForm
            userId={user.$id}
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
          if (tab !== 'proposals') setProposalsStatusFilter('DRAFT')
        }}
        userName={user.name || user.email}
        onLogout={handleLogout}
        logoutError={logoutError}
        onOpenPreferences={() => setShowPreferencesModal(true)}
        activePollEndDate={activePollEndDate}
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
                onNavigateToTab={(tab, statusFilter) => {
                  setTripDetailTab(tab as TripDetailTab)
                  if (tab === 'proposals' && statusFilter) {
                    setProposalsStatusFilter(statusFilter)
                  }
                }}
                onTripUpdated={handleTripUpdated}
                onAuthError={onAuthError}
                updateTrip={updateTrip}
                preferencesUpdated={preferencesUpdated}
                onOpenPreferences={() => setShowPreferencesModal(true)}
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
        userId={user.$id}
        initial={preferences}
        open={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onSaved={(prefs) => {
          setPreferences(prefs)
          setPreferencesUpdated({ userId: user.$id, preferences: prefs })
        }}
        createPreferences={createPreferences}
      />
      <Footer />
    </div>
  )
}

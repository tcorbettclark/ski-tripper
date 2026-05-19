import type { Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import AuthForm from './AuthForm'
import {
  account as _account,
  createPreferences as _createPreferences,
  deleteTrip as _deleteTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  getPreferences as _getPreferences,
  hasSession as _hasSession,
  leaveTrip as _leaveTrip,
  listParticipatedTrips as _listParticipatedTrips,
  listPolls as _listPolls,
  listTripParticipants as _listTripParticipants,
  listTrips as _listTrips,
  updateTrip as _updateTrip,
} from './backend'
import ErrorBoundary from './ErrorBoundary'
import Header from './Header'
import Overview from './Overview'
import Poll from './Poll'
import PreferencesForm from './PreferencesForm'
import PreferencesModal from './PreferencesModal'
import Proposals from './Proposals'
import TripInfo from './TripInfo'
import Trips from './Trips'
import { colors, fonts } from './theme'
import type { Preferences, Trip } from './types.d.ts'
import useAuth from './useAuth'

interface ListTripsResult {
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}

interface AppProps {
  hasSession?: () => boolean
  accountGet?: () => Promise<Models.User>
  deleteSession?: () => Promise<unknown>
  listTrips?: (userId: string) => Promise<ListTripsResult>
  listParticipatedTrips?: (userId: string) => Promise<{
    trips: Trip[]
  }>
  listTripParticipants?: (tripId: string) => Promise<{
    participants: Array<{
      $id: string
      participantUserName: string
      role: 'coordinator' | 'participant'
    }>
  }>
  listPolls?: (
    tripId: string,
    userId: string
  ) => Promise<{
    polls: Array<{ state: string; endDate: string }>
  }>
  updateTrip?: (
    tripId: string,
    data: { description: string },
    userId: string
  ) => Promise<unknown>
  deleteTrip?: (tripId: string, userId: string) => Promise<void>
  leaveTrip?: (userId: string, tripId: string) => Promise<void>
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
}

const defaultAccountGet = () => _account.get()
const defaultDeleteSession = () => _account.deleteSession('current')
const defaultListTrips = _listTrips
const defaultListParticipatedTrips = _listParticipatedTrips
const defaultListTripParticipants = _listTripParticipants
const defaultListPolls = _listPolls
const defaultUpdateTrip = _updateTrip
const defaultDeleteTrip = _deleteTrip
const defaultLeaveTrip = _leaveTrip
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant
const defaultGetPreferences = _getPreferences
const defaultCreatePreferences = _createPreferences

type TripDetailTab = 'overview' | 'proposals' | 'poll'

export default function App({
  hasSession = _hasSession,
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listTripParticipants = defaultListTripParticipants,
  listPolls = defaultListPolls,
  updateTrip = defaultUpdateTrip,
  deleteTrip = defaultDeleteTrip,
  leaveTrip = defaultLeaveTrip,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant,
  getPreferences = defaultGetPreferences,
  createPreferences = defaultCreatePreferences,
}: AppProps) {
  const { user, checking, sessionExpiredMessage, login, logout, onAuthError } =
    useAuth({ hasSession, accountGet, deleteSession })
  const [page, setPage] = useState<'login' | 'signup'>('login')
  const [view, setView] = useState<'tripList' | 'tripDetail'>('tripList')
  const [tripDetailTab, setTripDetailTab] = useState<TripDetailTab>('overview')
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)
  const [showTripInfo, setShowTripInfo] = useState(false)
  const [tripInfoTripId, setTripInfoTripId] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [checkingPreferences, setCheckingPreferences] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [activePollEndDate, setActivePollEndDate] = useState<string | null>(
    null
  )
  const autoSelectedRef = useRef(false)

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
    setShowTripInfo(false)
    setTripDetailTab('overview')
    listPolls(tripId, user.$id).then(({ polls }) => {
      const open = polls.find((p) => p.state === 'OPEN')
      setActivePollEndDate(open?.endDate || null)
    })
  }

  function handleViewAllTrips() {
    setView('tripList')
    setSelectedTripId(null)
    setTripDetailTab('overview')
    setShowTripInfo(false)
    setTripInfoTripId(null)
    setActivePollEndDate(null)
  }

  function handleActivePollChange(endDate: string | null) {
    setActivePollEndDate(endDate)
  }

  function handleShowTripInfo(tripId: string) {
    setTripInfoTripId(tripId)
    setShowTripInfo(true)
  }

  const selectedTrip = trips.find((t) => t.$id === selectedTripId) || null
  const tripInfoTrip =
    trips.find((t) => t.$id === (tripInfoTripId || selectedTripId)) || null

  if (checking) return null

  if (!user) {
    return (
      <AuthForm
        mode={page}
        onSuccess={login}
        onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
        sessionExpiredMessage={sessionExpiredMessage}
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
        tripName={selectedTrip?.description || selectedTrip?.code || ''}
        tripDetailTab={tripDetailTab}
        onViewAllTrips={handleViewAllTrips}
        onTripDetailTabChange={(tab) => setTripDetailTab(tab as TripDetailTab)}
        onShowTripInfo={() => handleShowTripInfo(selectedTripId!)}
        userName={user.name || user.email}
        onLogout={handleLogout}
        logoutError={logoutError}
        onOpenPreferences={() => setShowPreferencesModal(true)}
        activePollEndDate={activePollEndDate}
      />

      {view === 'tripList' && (
        <ErrorBoundary>
          <Trips
            user={user}
            trips={trips}
            onSelectTrip={handleSelectTrip}
            onJoinedTrip={handleJoinedTrip}
            getCoordinatorParticipant={getCoordinatorParticipant}
            onShowTripInfo={handleShowTripInfo}
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
                onNavigateToTab={(tab) =>
                  setTripDetailTab(tab as TripDetailTab)
                }
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

      {showTripInfo && tripInfoTrip && (
        <TripInfo
          trip={tripInfoTrip}
          user={user}
          open={showTripInfo}
          onClose={() => {
            setShowTripInfo(false)
            setTripInfoTripId(null)
          }}
          listTripParticipants={listTripParticipants}
          updateTrip={updateTrip}
          deleteTrip={deleteTrip}
          leaveTrip={leaveTrip}
          getCoordinatorParticipant={getCoordinatorParticipant}
          onLeft={() => {
            setTrips((ts) => ts.filter((t) => t.$id !== tripInfoTrip.$id))
            handleViewAllTrips()
          }}
          onDeleted={() => {
            setTrips((ts) => ts.filter((t) => t.$id !== tripInfoTrip.$id))
            handleViewAllTrips()
          }}
          onUpdated={(updated) => {
            const u = updated as { $id: string }
            setTrips((ts) =>
              ts.map((t) => (t.$id === u.$id ? (u as typeof t) : t))
            )
          }}
        />
      )}

      <PreferencesModal
        userId={user.$id}
        initial={preferences}
        open={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onSaved={(prefs) => setPreferences(prefs)}
        createPreferences={createPreferences}
      />
    </div>
  )
}

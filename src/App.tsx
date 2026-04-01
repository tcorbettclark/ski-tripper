import type { Models } from 'appwrite'
import { useCallback, useEffect, useState } from 'react'
import AuthForm from './AuthForm'
import {
  account as _account,
  deleteTrip as _deleteTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  leaveTrip as _leaveTrip,
  listParticipatedTrips as _listParticipatedTrips,
  listTripParticipants as _listTripParticipants,
  listTrips as _listTrips,
  updateTrip as _updateTrip,
} from './backend'
import ErrorBoundary from './ErrorBoundary'
import Header from './Header'
import Poll from './Poll'
import Proposals from './Proposals'
import TripOverview from './TripOverview'
import Trips from './Trips'
import { colors, fonts } from './theme'

interface ListTripsResult {
  trips: Array<{ $id: string; description?: string; code?: string }>
  coordinatorUserIds: Record<string, string>
}

interface AppProps {
  accountGet?: () => Promise<Models.User>
  deleteSession?: () => Promise<unknown>
  listTrips?: (userId: string) => Promise<ListTripsResult>
  listParticipatedTrips?: (userId: string) => Promise<{
    trips: Array<{ $id: string; description?: string; code?: string }>
  }>
  listTripParticipants?: (tripId: string) => Promise<{
    participants: Array<{
      $id: string
      participantUserName: string
      role: 'coordinator' | 'participant'
    }>
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
}

const defaultAccountGet = _account.get.bind(_account)
const defaultDeleteSession = _account.deleteSession.bind(_account, 'current')
const defaultListTrips = _listTrips.bind(_listTrips)
const defaultListParticipatedTrips = _listParticipatedTrips.bind(
  _listParticipatedTrips
)
const defaultListTripParticipants = _listTripParticipants.bind(
  _listTripParticipants
)
const defaultUpdateTrip = _updateTrip.bind(_updateTrip)
const defaultDeleteTrip = _deleteTrip.bind(_deleteTrip)
const defaultLeaveTrip = _leaveTrip.bind(_leaveTrip)
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant.bind(
  _getCoordinatorParticipant
)

export default function App({
  accountGet = defaultAccountGet,
  deleteSession = defaultDeleteSession,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listTripParticipants = defaultListTripParticipants,
  updateTrip = defaultUpdateTrip,
  deleteTrip = defaultDeleteTrip,
  leaveTrip = defaultLeaveTrip,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant,
}: AppProps) {
  const [user, setUser] = useState<Models.User | null>(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState<'login' | 'signup'>('login')
  const [view, setView] = useState<'tripList' | 'tripDetail'>('tripList')
  const [tripDetailTab, setTripDetailTab] = useState<
    'overview' | 'proposals' | 'poll'
  >('overview')
  const [trips, setTrips] = useState<
    Array<{ $id: string; description?: string; code?: string }>
  >([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)

  const handleJoinedTrip = useCallback(() => {
    if (!user) return
    Promise.all([listTrips(user.$id), listParticipatedTrips(user.$id)])
      .then(([ownRes, participatedRes]) => {
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
      })
      .catch((err) => console.error('Failed to load trips:', err))
    setRefreshProposalsKey((k) => k + 1)
  }, [user, listTrips, listParticipatedTrips])

  useEffect(() => {
    accountGet()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [accountGet])

  useEffect(() => {
    if (!user) return
    Promise.all([listTrips(user.$id), listParticipatedTrips(user.$id)])
      .then(([ownRes, participatedRes]) => {
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
      })
      .catch((err) => console.error('Failed to load trips:', err))
  }, [user, listTrips, listParticipatedTrips])

  async function handleLogout() {
    await deleteSession()
    setUser(null)
  }

  function handleSelectTrip(tripId: string) {
    setSelectedTripId(tripId)
    setView('tripDetail')
    setTripDetailTab('overview')
  }

  function handleViewAllTrips() {
    setView('tripList')
    setSelectedTripId(null)
    setTripDetailTab('overview')
  }

  const selectedTrip = trips.find((t) => t.$id === selectedTripId) || null

  if (checking) return null

  if (!user) {
    return (
      <AuthForm
        mode={page}
        onSuccess={setUser}
        onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
      />
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
        onTripDetailTabChange={(tab) =>
          setTripDetailTab(tab as 'overview' | 'proposals' | 'poll')
        }
        userName={user.name || user.email}
        onLogout={handleLogout}
      />

      {view === 'tripList' && (
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
              <TripOverview
                trip={selectedTrip}
                user={user}
                listTripParticipants={listTripParticipants}
                updateTrip={updateTrip}
                deleteTrip={deleteTrip}
                leaveTrip={leaveTrip}
                getCoordinatorParticipant={getCoordinatorParticipant}
                onLeft={() => {
                  setTrips((ts) => ts.filter((t) => t.$id !== selectedTripId))
                  handleViewAllTrips()
                }}
                onDeleted={() => {
                  setTrips((ts) => ts.filter((t) => t.$id !== selectedTripId))
                  handleViewAllTrips()
                }}
                onUpdated={(updated) => {
                  const u = updated as { $id: string }
                  setTrips((ts) =>
                    ts.map((t) => (t.$id === u.$id ? (u as typeof t) : t))
                  )
                }}
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
              />
            </ErrorBoundary>
          )}
          {tripDetailTab === 'poll' && (
            <ErrorBoundary>
              <Poll user={user} tripId={selectedTripId} />
            </ErrorBoundary>
          )}
        </>
      )}
    </div>
  )
}

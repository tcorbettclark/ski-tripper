import type { Models } from 'appwrite'
import { useCallback, useEffect, useRef, useState } from 'react'
import AuthForm from './AuthForm'
import {
  account as _account,
  deleteTrip as _deleteTrip,
  getCoordinatorParticipant as _getCoordinatorParticipant,
  leaveTrip as _leaveTrip,
  listParticipatedTrips as _listParticipatedTrips,
  listPolls as _listPolls,
  listTripParticipants as _listTripParticipants,
  listTrips as _listTrips,
  updateTrip as _updateTrip,
} from './backend'
import ErrorBoundary from './ErrorBoundary'
import Header from './Header'
import Poll from './Poll'
import Proposals from './Proposals'
import TripInfo from './TripInfo'
import Trips from './Trips'
import { colors, fonts } from './theme'

import type { Trip } from './types.d.ts'

interface ListTripsResult {
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}

interface AppProps {
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
    polls: Array<{ state: string }>
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
const defaultListPolls = _listPolls.bind(_listPolls)
const defaultUpdateTrip = _updateTrip.bind(_updateTrip)
const defaultDeleteTrip = _deleteTrip.bind(_deleteTrip)
const defaultLeaveTrip = _leaveTrip.bind(_leaveTrip)
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant.bind(
  _getCoordinatorParticipant
)

type TripDetailTab = 'proposals' | 'poll'

export default function App({
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
}: AppProps) {
  const [user, setUser] = useState<Models.User | null>(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState<'login' | 'signup'>('login')
  const [view, setView] = useState<'tripList' | 'tripDetail'>('tripList')
  const [tripDetailTab, setTripDetailTab] = useState<TripDetailTab>('proposals')
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [refreshProposalsKey, setRefreshProposalsKey] = useState(0)
  const [showTripInfo, setShowTripInfo] = useState(false)
  const [tripInfoTripId, setTripInfoTripId] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
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
    accountGet()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [accountGet])

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
      setTripDetailTab('proposals')
      listPolls(trip.$id, user.$id).then(({ polls }) => {
        const hasActivePoll = polls.some((p) => p.state === 'OPEN')
        setTripDetailTab(hasActivePoll ? 'poll' : 'proposals')
      })
      setView('tripDetail')
    }
  }, [trips, user, view, listPolls])

  async function handleLogout() {
    setLogoutError(null)
    try {
      await deleteSession()
      setUser(null)
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleSelectTrip(tripId: string) {
    if (!user) return
    setSelectedTripId(tripId)
    setView('tripDetail')
    setShowTripInfo(false)
    setTripDetailTab('proposals')
    listPolls(tripId, user.$id).then(({ polls }) => {
      const hasActivePoll = polls.some((p) => p.state === 'OPEN')
      setTripDetailTab(hasActivePoll ? 'poll' : 'proposals')
    })
  }

  function handleViewAllTrips() {
    setView('tripList')
    setSelectedTripId(null)
    setTripDetailTab('proposals')
    setShowTripInfo(false)
    setTripInfoTripId(null)
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
        onTripDetailTabChange={(tab) => setTripDetailTab(tab as TripDetailTab)}
        onShowTripInfo={() => handleShowTripInfo(selectedTripId!)}
        userName={user.name || user.email}
        onLogout={handleLogout}
        logoutError={logoutError}
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
    </div>
  )
}

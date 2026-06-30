import { Info } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Participant,
  Preferences,
  ResortWithEmbedding,
  Trip,
  User,
} from '../shared/types.d'
import AboutModal from './AboutModal'
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
} from './backend'
import ErrorBoundary from './ErrorBoundary'
import Footer from './Footer'
import ForgotPasswordForm from './ForgotPasswordForm'
import Header from './Header'
import LandingSeoContent from './LandingSeoContent'
import OtpCodeEntry from './OtpCodeEntry'
import Overview from './Overview'
import PreferencesForm from './PreferencesForm'
import PreferencesModal from './PreferencesModal'
import Proposals from './Proposals'
import type { StatusFilter } from './ProposalsGrid'
import Resorts from './Resorts'
import SetPasswordForm from './SetPasswordForm'
import ToastContainer from './ToastContainer'
import Trips from './Trips'
import { colors, fontSizes, fonts, mix } from './theme'
import { toast } from './toast'
import useAuth from './useAuth'
import useIsSmallScreen from './useIsSmallScreen'
import { getErrorMessage } from './utils'
import Voting from './Voting'

interface ListTripsResult {
  trips: Trip[]
  coordinatorUserIds: Record<string, string>
}

type PageState =
  | 'login'
  | 'signup'
  | 'signupOtp'
  | 'forgotPassword'
  | 'forgotPasswordOtp'

interface AppProps {
  useAuthHook?: typeof useAuth
  useIsSmallScreenHook?: () => boolean
  useAutoHideFooterHook?: () => 'visible' | 'hidden'
  hasSession?: () => boolean
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
  fetchResortDataWithAuth?: () => Promise<string>
  updateName?: (name: string) => Promise<unknown>
  listTripParticipants?: (
    tripId: string
  ) => Promise<{ participants: Participant[] }>
}

const defaultListTrips = _listTrips
const defaultListParticipatedTrips = _listParticipatedTrips
const defaultListPolls = _listPolls
const defaultGetCoordinatorParticipant = _getCoordinatorParticipant
const defaultGetPreferences = _getPreferences
const defaultCreatePreferences = _createPreferences
const defaultUpdateTrip = _updateTrip
const defaultFetchResortDataWithAuth = _fetchResortDataWithAuth
const defaultUpdateName = _updateName
const defaultListTripParticipants = _listTripParticipants

function mapUser(record: Record<string, unknown>): User {
  return {
    id: record.id as string,
    name: (record.name as string) || '',
    email: record.email as string,
    emailVerification: record.verified as boolean,
  }
}

type TripDetailTab = 'overview' | 'resorts' | 'proposals' | 'voting'

type ProposalDetail = {
  proposalId: string
  subTab: 'proposal' | 'accommodations' | 'discussion'
}

export default function App({
  useAuthHook = useAuth,
  useIsSmallScreenHook = useIsSmallScreen,
  useAutoHideFooterHook,
  hasSession = _hasSession,
  listTrips = defaultListTrips,
  listParticipatedTrips = defaultListParticipatedTrips,
  listPolls = defaultListPolls,
  getCoordinatorParticipant = defaultGetCoordinatorParticipant,
  getPreferences = defaultGetPreferences,
  createPreferences = defaultCreatePreferences,
  updateTrip = defaultUpdateTrip,
  fetchResortDataWithAuth = defaultFetchResortDataWithAuth,
  updateName = defaultUpdateName,
  listTripParticipants = defaultListTripParticipants,
}: AppProps) {
  const isSmall = useIsSmallScreenHook()
  const resetAuthPageState = useCallback(() => {
    setPage('login')
    setOtpId(null)
    setOtpEmail(null)
    setNeedsPassword(false)
  }, [])

  const { user, checking, login, logout, onAuthError, refreshUser } =
    useAuthHook({ hasSession, onLogout: resetAuthPageState })
  const [page, setPage] = useState<PageState>('login')
  const [otpId, setOtpId] = useState<string | null>(null)
  const [otpEmail, setOtpEmail] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
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
          .map((line) => {
            const r = JSON.parse(line) as ResortWithEmbedding
            return {
              ...r,
              beginnerPct: r.beginnerPct ?? 0,
              intermediatePct: r.intermediatePct ?? 0,
              advancedPct: r.advancedPct ?? 0,
              pisteKm: r.pisteKm ?? 0,
              liftCount: r.liftCount ?? 0,
              summitAltitude: r.summitAltitude ?? 0,
              baseAltitude: r.baseAltitude ?? 0,
            }
          })
        setResorts(parsed)
      })
      .catch(() => setResorts([]))
  }, [user, fetchResortDataWithAuth])

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
    try {
      logout()
    } catch (err) {
      toast(getErrorMessage(err), 'error')
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

  function handleOtpSuccess(record: Record<string, unknown>) {
    const authenticatedUser = mapUser(record)
    login(authenticatedUser)
    setNeedsPassword(true)
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null

  if (checking) return <ToastContainer />

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

    if (page === 'signupOtp' && otpId && otpEmail) {
      return (
        <main>
          {aboutButton}
          <OtpCodeEntry
            email={otpEmail}
            otpId={otpId}
            onSuccess={handleOtpSuccess}
            onBack={handleLogout}
          />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
          <ToastContainer />
        </main>
      )
    }

    if (page === 'forgotPasswordOtp' && otpId && otpEmail) {
      return (
        <main>
          {aboutButton}
          <OtpCodeEntry
            email={otpEmail}
            otpId={otpId}
            onSuccess={handleOtpSuccess}
            onBack={handleLogout}
          />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
          <ToastContainer />
        </main>
      )
    }

    if (page === 'forgotPassword') {
      return (
        <main>
          {aboutButton}
          <ForgotPasswordForm
            onBackToLogin={handleLogout}
            onOtpRequested={(newOtpId, email) => {
              setOtpId(newOtpId)
              setOtpEmail(email)
              setPage('forgotPasswordOtp')
            }}
          />
          <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
          <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
          <ToastContainer />
        </main>
      )
    }

    return (
      <main>
        {aboutButton}
        <AuthForm
          mode={page === 'signup' ? 'signup' : 'login'}
          onSuccess={login}
          onOtpRequested={(newOtpId, email) => {
            setOtpId(newOtpId)
            setOtpEmail(email)
            setPage('signupOtp')
          }}
          onSwitchMode={() => setPage(page === 'login' ? 'signup' : 'login')}
          onForgotPassword={() => setPage('forgotPassword')}
        />
        <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        <LandingSeoContent />
        <ToastContainer />
      </main>
    )
  }

  if (needsPassword && user) {
    return (
      <main>
        <SetPasswordForm
          email={user.email}
          onSuccess={() => setNeedsPassword(false)}
          onSignOut={handleLogout}
        />
        <Footer useAutoHideFooterHook={useAutoHideFooterHook} />
        <ToastContainer />
      </main>
    )
  }

  if (checkingPreferences) return null

  if (!preferences) {
    return (
      <main
        style={{
          fontFamily: fonts.body,
          background: colors.bgPrimary,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isSmall ? '16px' : '24px',
        }}
      >
        <div
          style={{
            background: colors.bgCard,
            border: `1px solid ${mix('--color-textSecondary', 0.12)}`,
            borderRadius: '16px',
            padding: isSmall ? '28px 20px' : '48px 44px',
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
            onSignOut={handleLogout}
            createPreferences={createPreferences}
          />
        </div>
        <ToastContainer />
      </main>
    )
  }

  return (
    <main
      style={{
        fontFamily: fonts.body,
        background: colors.bgPrimary,
        minHeight: '100dvh',
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
                resorts={resorts}
                refreshTrigger={refreshProposalsKey}
                statusFilter={proposalsStatusFilter}
                onStatusFilterChange={setProposalsStatusFilter}
                proposalDetail={proposalDetail ?? undefined}
                onRefresh={() => setRefreshProposalsKey((k) => k + 1)}
                onAuthError={onAuthError}
              />
            </ErrorBoundary>
          )}
          {tripDetailTab === 'voting' && (
            <ErrorBoundary>
              <Voting
                user={user}
                tripId={selectedTripId}
                onActivePollChange={handleActivePollChange}
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
      <Footer useAutoHideFooterHook={useAutoHideFooterHook} isSmall={isSmall} />
      <ToastContainer />
    </main>
  )
}

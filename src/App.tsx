import { useEffect } from 'react';

import {
  AppProvider,
  useApp,
} from '@/store';

import Splash from '@/screens/Splash';
import Welcome from '@/screens/Welcome';
import Login from '@/screens/Login';
import Register from '@/screens/Register';
import Setup from '@/screens/Setup';
import Home from '@/screens/Home';
import Search from '@/screens/Search';
import Destination from '@/screens/Destination';
import Routes from '@/screens/Routes';
import Navigation from '@/screens/Navigation';
import Details from '@/screens/Details';
import Report from '@/screens/Report';
import Saved from '@/screens/Saved';
import Profile from '@/screens/Profile';
import SOS from '@/screens/SOS';

import type { ScreenName } from '@/types';

import { checkBackend } from '@/api';


// ============================================================
// SCREEN MAP
// ============================================================

const SCREENS: Record<
  ScreenName,
  () => JSX.Element | null
> = {

  splash: Splash,

  welcome: Welcome,

  login: Login,

  register: Register,

  setup: Setup,

  home: Home,

  search: Search,

  destination: Destination,

  routes: Routes,

  navigation: Navigation,

  details: Details,

  report: Report,

  saved: Saved,

  profile: Profile,

  sos: SOS,
};


// ============================================================
// ROUTER
// ============================================================

function Router() {

  const {
    screen,
    authLoading,
  } = useApp();


  // ----------------------------------------------------------
  // While checking whether a previous login exists,
  // show the splash screen.
  // ----------------------------------------------------------

  if (authLoading) {
    return <Splash />;
  }


  // ----------------------------------------------------------
  // Render current screen
  // ----------------------------------------------------------

  const Screen =
    SCREENS[screen] ?? Splash;


  return <Screen />;
}


// ============================================================
// BACKEND CONNECTION TEST
// ============================================================

function BackendConnectionTest() {

  useEffect(() => {

    checkBackend()

      .then((data) => {

        console.log(
          'Backend connected successfully:',
          data
        );

      })

      .catch((error) => {

        console.error(
          'Backend connection failed:',
          error
        );

      });

  }, []);


  return null;
}


// ============================================================
// APP
// ============================================================

function App() {

  return (
    <AppProvider>

      {/* ----------------------------------------------------
          Test connection between React and FastAPI
      ----------------------------------------------------- */}

      <BackendConnectionTest />


      <div
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-slate-900
          p-0
          sm:p-6
        "
      >

        {/* --------------------------------------------------
            Phone frame
            390 × 844
        --------------------------------------------------- */}

        <div
          className="
            relative
            h-[100dvh]
            w-full
            overflow-hidden
            bg-white

            sm:h-[844px]
            sm:max-h-[100dvh]
            sm:w-[390px]
            sm:rounded-[2.5rem]
            sm:shadow-2xl
            sm:ring-[10px]
            sm:ring-slate-900
          "
        >

          {/* ------------------------------------------------
              Notch - desktop only
          ------------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-0
              z-50
              hidden
              h-6
              w-32
              -translate-x-1/2
              rounded-b-2xl
              bg-slate-900
              sm:block
            "
          />


          {/* ------------------------------------------------
              Application screens
          ------------------------------------------------- */}

          <Router />

        </div>

      </div>

    </AppProvider>
  );
}


export default App;
'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Location from '@/types/location';
import { useUser } from './useUser';
import { useSocket } from './useSocket';
import { SavedFix, shouldPersistFix } from '../utils/geolocation';
import { useT } from '../i18n/client';
import type { TFunction } from '../i18n/messages';

// 'checking' - still finding out, render nothing permission-related yet.
// 'prompt'   - not granted yet (or the browser won't say): needs a tap.
export type LocationAccess = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

// Set after a real fix, so a browser whose permissions.query rejects for
// geolocation (iOS Safari) still resumes the live watch on the next visit
// instead of asking for another tap.
const GRANTED_HINT_KEY = 'wc:location-granted';

// A cold iOS GPS lock regularly takes longer than a few seconds - a tight
// timeout here reports an error for a fix that was about to arrive.
const REQUEST_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};

const readGrantedHint = () => {
  try {
    return localStorage.getItem(GRANTED_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

const writeGrantedHint = (granted: boolean) => {
  try {
    if (granted) localStorage.setItem(GRANTED_HINT_KEY, '1');
    else localStorage.removeItem(GRANTED_HINT_KEY);
  } catch { }
};

// By code, not the browser's own error.message: that one is English
// whatever language the page is in.
const errorText = (error: GeolocationPositionError, t: TFunction) => {
  switch (error.code) {
    case error.PERMISSION_DENIED: return t('locations.errors.denied');
    case error.POSITION_UNAVAILABLE: return t('locations.errors.unavailable');
    case error.TIMEOUT: return t('locations.errors.timeout');
    default: return t('locations.errors.generic');
  }
};

type Source = 'gesture' | 'granted' | 'hint';

const FLUSH_CHECK_MS = 5000;

const noopSubscribe = () => () => { };

const useLocation = () => {
  const { user } = useUser();
  const t = useT();
  const { socket } = useSocket();
  const [position, setPosition] = useState<Location>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    username: null,
    time: null
  });
  const [locationAccessinfo, setLocationAccessinfo] = useState<LocationAccess>('checking');
  // Assumed supported for the server render, so hydration matches.
  const geolocationSupported = useSyncExternalStore(noopSubscribe, () => 'geolocation' in navigator, () => true);

  const socketRef = useRef(socket);
  const emailRef = useRef(user?.email ?? null);
  const watchIdRef = useRef<number | null>(null);
  const lastFixRef = useRef<Location | null>(null);
  const lastSavedRef = useRef<SavedFix | null>(null);

  useEffect(() => { emailRef.current = user?.email ?? null; }, [user?.email]);

  // The map reads positions from the 'get locations' socket, not from this
  // hook's state - a fix only reaches it through this emit. Throttled (see
  // shouldPersistFix) since every emit is a Mongo write.
  const flushSave = useCallback(() => {
    const fix = lastFixRef.current;
    const currentSocket = socketRef.current;
    if (!fix || !currentSocket || fix.latitude == null || fix.longitude == null) return;

    const candidate: SavedFix = {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy ?? Infinity,
      at: Date.now()
    };
    const previous = lastSavedRef.current;
    if (!shouldPersistFix(previous, candidate)) return;

    lastSavedRef.current = candidate;
    currentSocket.emit('save location', fix, (saved: boolean) => {
      // The server keeps its own once-per-30s limit per account (another tab
      // or device may have just written). Held back means this fix isn't
      // stored, so forget it and the next interval tick offers it again.
      if (!saved && lastSavedRef.current === candidate) lastSavedRef.current = previous;
    });
  }, []);

  useEffect(() => {
    socketRef.current = socket;
    // A fix that arrived before the socket did.
    flushSave();
  }, [socket, flushSave]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const handleFix = useCallback((pos: GeolocationPosition) => {
    const fix: Location = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      loading: false,
      error: null,
      username: emailRef.current,
      time: new Date(pos.timestamp || Date.now())
    };
    lastFixRef.current = fix;
    setPosition(fix);
    setLocationAccessinfo('granted');
    writeGrantedHint(true);
    flushSave();
  }, [flushSave]);

  const handleError = useCallback((error: GeolocationPositionError, source: Source) => {
    if (error.code === error.PERMISSION_DENIED) {
      stopWatch();
      writeGrantedHint(false);
      setPosition(prev => ({ ...prev, loading: false, error: errorText(error, t) }));
      // Resuming from the stored hint happens outside a tap, and iOS answers
      // that with "denied" once its per-site grant has lapsed, without ever
      // having asked. That's not the user saying no - offer the button again.
      setLocationAccessinfo(source === 'hint' ? 'prompt' : 'denied');
      return;
    }
    // Unavailable / timeout: a real, possibly transient failure - keep its
    // message, but it says nothing about permission, and a fix already in
    // hand stays on the map.
    setPosition(prev => ({ ...prev, loading: false, error: errorText(error, t) }));
    setLocationAccessinfo(prev => prev === 'checking' ? 'prompt' : prev);
  }, [stopWatch, t]);

  // One watch for the life of the page. Restarting it isn't a user gesture,
  // drops fixes in between, and on iOS often errors instead of updating.
  const startWatch = useCallback((source: Source) => {
    if (!navigator.geolocation || watchIdRef.current != null) return;
    if (!lastFixRef.current) setPosition(prev => ({ ...prev, loading: true }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleFix,
      error => handleError(error, source),
      WATCH_OPTIONS
    );
  }, [handleFix, handleError]);

  // Must be called straight from a click/tap handler. iOS Safari only shows
  // the permission prompt for a geolocation call made synchronously inside a
  // user gesture, and that activation is gone after the first await - so
  // getCurrentPosition is the very first thing this does, same as
  // shareLocationButton.
  const requestLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        handleFix(pos);
        startWatch('gesture');
      },
      error => handleError(error, 'gesture'),
      REQUEST_OPTIONS
    );
    setPosition(prev => ({ ...prev, loading: true, error: null }));
  }, [handleFix, handleError, startWatch]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    // permissions.query is only a hint: iOS Safari often rejects it for
    // geolocation, and a failed query is not a denial.
    const withoutQuery = () => {
      if (cancelled) return;
      if (readGrantedHint()) startWatch('hint');
      else setLocationAccessinfo('prompt');
    };

    const applyQueryState = (state: PermissionState) => {
      setLocationAccessinfo(state);
      if (state === 'granted') startWatch('granted');
      else if (state === 'denied') {
        stopWatch();
        writeGrantedHint(false);
      }
    };

    if (!navigator.permissions?.query) {
      withoutQuery();
    } else {
      navigator.permissions.query({ name: 'geolocation' })
        .then(status => {
          if (cancelled) return;
          permissionStatus = status;
          // A fix that already landed is stronger evidence than a 'prompt'
          // some browsers keep reporting after a one-time allow.
          if (status.state === 'prompt' && lastFixRef.current) startWatch('gesture');
          else applyQueryState(status.state);
          status.onchange = () => applyQueryState(status.state);
        })
        .catch(withoutQuery);
    }

    // Emits the last known fix once it's due (see flushSave) - this is how a
    // move that arrived inside the 30s window, or one the server held back,
    // still gets saved when no further fix comes. Checked more often than the
    // window itself so it isn't forever landing just short of the server's.
    const interval = setInterval(flushSave, FLUSH_CHECK_MS);

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
      clearInterval(interval);
      stopWatch();
    };
  }, [startWatch, stopWatch, flushSave]);

  return {
    position,
    locationAccessinfo: geolocationSupported ? locationAccessinfo : 'unsupported' as LocationAccess,
    requestLocation
  };
};

export default useLocation;

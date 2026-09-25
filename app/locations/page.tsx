'use client';
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useSocket } from '../hooks/useSocket';
import Location from '@/types/location';
import ciEquals from '../utils/ciEqual';
import useLocation from '../hooks/useLocation';
import LocationAccessInformation from '../components/locations/locationAccessStatus';
import { useUser } from '../hooks/useUser';
import LocationsTable, { FriendDistanceRow } from '../components/locations/locationsTable';
import { getDistanceKm } from '../utils/geolocation';
import { useT } from '../i18n/client';


const center = {
  lat: 31.4117257,
  lng: 35.0818155
};

// Units and digits in the viewer's locale ("5.20 km", "5,20 км", "٥٫٢٠ كم").
const formatDistance = (distanceKm: number, locale: string) => {
  if (distanceKm < 1) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', maximumFractionDigits: 0 })
      .format(Math.round(distanceKm * 1000));
  }

  const digits = distanceKm < 10 ? 2 : 1;
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilometer', minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(distanceKm);
};


function Locations() {
  const t = useT();
  const { position: myFix, locationAccessinfo, requestLocation } = useLocation();
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
  })

  const [map, setMap] = useState(null)
  const { socket, loadingSocket } = useSocket();

  const [positions, setPositions] = useState<Location[] | null>(null)
  const [showInfoWindow, setShowInfoWindow] = useState<boolean[]>([]);

  const { user } = useUser();

  const getPositions = useCallback(() => {
    socket?.emit('get locations');
  }, [socket]);

  const containerStyle = useMemo(() => ({
    width: '100%',
    height: '60vh',
  }), []);

  const currentUserPosition = useMemo(() => {
    // This device's own live fix is fresher than whatever was last saved.
    if (myFix.latitude != null && myFix.longitude != null) return myFix;
    if (!positions?.length || !user?.email) return null;

    return positions.find(
      position =>
        ciEquals(position.username || '', user.email || '') &&
        position.latitude != null &&
        position.longitude != null &&
        !position.loading
    ) || null;
  }, [myFix, positions, user?.email]);

  const friendsWithDistance = useMemo<FriendDistanceRow[]>(() => {
    if (!positions?.length) return [];

    return positions
      .filter(position =>
        !position.loading &&
        position.latitude != null &&
        position.longitude != null &&
        position.username &&
        !ciEquals(position.username, user?.email || '')
      )
      .map(position => {
        let distanceText = 'N/A';
        let distanceKm: number | null = null;

        if (currentUserPosition?.latitude != null &&
          currentUserPosition?.longitude != null &&
          position.latitude != null &&
          position.longitude != null) {
          distanceKm = getDistanceKm(
            { lat: currentUserPosition.latitude, lng: currentUserPosition.longitude },
            { lat: position.latitude, lng: position.longitude }
          );
          distanceText = formatDistance(distanceKm, t.dateLocale);
        }

        return {
          username: position.username!,
          distanceText,
          distanceKm,
          accuracy: position.accuracy,
          updatedAt: position.time ? new Date(position.time).toLocaleString(t.dateLocale, { hour12: false }) : t('locations.unknown'),
        };
      })
      .sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [currentUserPosition?.latitude, currentUserPosition?.longitude, positions, user?.email, t]);

  useEffect(() => {
    setShowInfoWindow(positions?.map(() => false) || []);
  }, [positions]);

  useEffect(() => {
    if (loadingSocket) return;

    const updatePositions = (data: Location[]) => {
      setPositions(data);
    };

    // Our own save, echoed back once it's persisted - replaced in place so
    // the other pins (and their open info windows) keep their indexes.
    const updateOwnPosition = (saved: Location) => {
      setPositions(prev => {
        const list = prev ?? [];
        const index = list.findIndex(p => ciEquals(p.username || '', saved.username || ''));
        if (index === -1) return [...list, saved];
        const next = [...list];
        next[index] = saved;
        return next;
      });
    };

    socket?.on("get locations", updatePositions);
    socket?.on("location saved", updateOwnPosition);
    getPositions();

    return () => {
      socket?.off("get locations", updatePositions);
      socket?.off("location saved", updateOwnPosition);
    };
  }, [loadingSocket, socket]);

  const onLoad = useCallback(async function callback(map: any) {

    setMap(map)
  }, [])

  const onUnmount = useCallback(function callback(map: any) {
    setMap(null)
  }, [])

  const hasFix = myFix.latitude != null && myFix.longitude != null;

  // Friends' pins and the distance table don't depend on this device's GPS,
  // so the page always renders - location access only decides the banner.
  return (
    <section className="mx-auto w-full max-w-6xl px-3 pb-8 pt-2 sm:px-4">
      <h1 className="mb-4 text-center text-2xl font-extrabold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
        <span className="text-transparent bg-clip-text bg-linear-to-r to-blue-900 from-teal-700 dark:to-blue-400 dark:from-teal-300">{t('locations.title')}</span>
      </h1>

      <LocationAccessInformation
        information={locationAccessinfo}
        hasFix={hasFix}
        locating={myFix.loading}
        error={myFix.error}
        onEnable={requestLocation}
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/70 shadow-xs dark:border-gray-700 dark:bg-gray-900/60">
        {isLoaded ? <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={8}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {
            positions?.map((position, index) =>
              !position?.loading &&
              (<Marker key={index}
                icon={!ciEquals(position.username!, user?.email) ? 'https://maps.gstatic.com/mapfiles/ms2/micons/man.png' : ''}
                position={{
                  lat: position.latitude as number,
                  lng: position.longitude as number
                }}
                onClick={() => setShowInfoWindow(perv => {
                  const newArray = [...perv];
                  newArray[index] = true;
                  return newArray;
                })}
              >
                {showInfoWindow[index] && (
                  <InfoWindow
                    position={{
                      lat: position.latitude as number,
                      lng: position.longitude as number
                    }}
                    onCloseClick={() => setShowInfoWindow(perv => {
                      const newArray = [...perv];
                      newArray[index] = false;
                      return newArray;
                    })}
                  >
                    <div>
                      <p>{t('locations.details')}</p>
                      <p>{t('locations.user', { name: ciEquals(position.username!, user?.email) ? t('common.you') : position.username ?? '' })}</p>
                      {position?.time &&
                        <p>{t('locations.lastUpdate', { date: new Date(position?.time).toLocaleString(t.dateLocale, { hour12: false }) })}</p>}
                      {position?.accuracy! > 200 &&
                        <p>{t('locations.notAccurate')}</p>}
                    </div>
                  </InfoWindow>

                )}
              </Marker>)
            )
          }
        </GoogleMap> : <div style={containerStyle} />}
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700 dark:bg-gray-900 sm:p-4">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">{t('locations.distanceFromYou')}</h2>
          {!currentUserPosition && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t('locations.enableToCalculate')}</p>
          )}
        </div>

        <LocationsTable friendsWithDistance={friendsWithDistance} />
      </div>
    </section>
  );
}

export default Locations;

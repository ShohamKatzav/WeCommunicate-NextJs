'use client';
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useSocket } from '../hooks/useSocket';
import Location from '@/types/location';
import ciEquals from '../utils/ciEqual';
import useLocation from '../hooks/useLocation';
import LocationAccessInformation from '../components/locationAccessStatus';
import { useUser } from '../hooks/useUser';
import LocationsTable, { FriendDistanceRow } from '../components/locationsTable';


const center = {
  lat: 31.4117257,
  lng: 35.0818155
};

const EARTH_RADIUS_KM = 6371;

const toRad = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const fromLat = toRad(from.lat);
  const toLat = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(fromLat) * Math.cos(toLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

const formatDistance = (distanceKm: number) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km`;
};


function Locations() {
  const { locationAccessinfo } = useLocation();
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
    if (!positions?.length || !user?.email) return null;

    return positions.find(
      position =>
        ciEquals(position.username || '', user.email || '') &&
        position.latitude != null &&
        position.longitude != null &&
        !position.loading
    ) || null;
  }, [positions, user?.email]);

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
          distanceText = formatDistance(distanceKm);
        }

        return {
          username: position.username!,
          distanceText,
          distanceKm,
          accuracy: position.accuracy,
          updatedAt: position.time ? new Date(position.time).toLocaleString() : 'Unknown',
        };
      })
      .sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
  }, [currentUserPosition?.latitude, currentUserPosition?.longitude, positions, user?.email]);

  useEffect(() => {
    setShowInfoWindow(positions?.map(() => false) || []);
  }, [positions]);

  useEffect(() => {
    if (loadingSocket) return;

    const updatePositions = (data: Location[]) => {
      setPositions(data);
    };

    socket?.on("get locations", updatePositions);
    getPositions();

    return () => {
      socket?.off("get locations", updatePositions);
    };
  }, [loadingSocket, socket]);

  const onLoad = useCallback(async function callback(map: any) {

    setMap(map)
  }, [])

  const onUnmount = useCallback(function callback(map: any) {
    setMap(null)
  }, [])

  if (locationAccessinfo !== "granted") return <LocationAccessInformation information={locationAccessinfo} />

  return isLoaded ? (
    <section className="mx-auto w-full max-w-6xl px-3 pb-8 pt-2 sm:px-4">
      <h1 className="mb-4 text-center text-2xl font-extrabold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
        <span className="text-transparent bg-clip-text bg-linear-to-r to-blue-900 from-teal-400">Friends&apos; locations</span>
      </h1>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/70 shadow-xs dark:border-gray-700 dark:bg-gray-900/60">
        <GoogleMap
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
                      <p>Location Details:</p>
                      <p>User: {ciEquals(position.username!, user?.email) ? 'You' : position.username}</p>
                      {position?.time &&
                        <p>Last update: {new Date(position?.time).toLocaleString()}</p>}
                      {position?.accuracy! > 200 &&
                        <p>(Not accurate)</p>}
                    </div>
                  </InfoWindow>

                )}
              </Marker>)
            )
          }
        </GoogleMap>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-700 dark:bg-gray-900 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">Distance from you</h2>
          {!currentUserPosition && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Enable your location to calculate distances</p>
          )}
        </div>

        <LocationsTable friendsWithDistance={friendsWithDistance} />
      </div>
    </section>)
    : <></>
}

export default Locations;

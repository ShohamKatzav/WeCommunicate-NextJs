'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useSocket } from '../hooks/useSocket';
import Location from '../types/location';
import ciEquals from '../utils/ciEqual';
import useLocation from '../hooks/useLocation';
import LocationAccessInformation from '../components/locationAccessStatus';
import useIsMedium from '../hooks/useIsMedium';
import { useUser } from '../hooks/useUser';


const center = {
  lat: 31.4117257,
  lng: 35.0818155
};


function Locations(props: any) {
  const { locationAccessinfo } = useLocation();
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
  })

  const [map, setMap] = useState(null)
  const { socket, loadingSocket } = useSocket();

  const [positions, setPositions] = useState<Location[] | null>(null)
  const positionsRef = useRef(positions);
  const [showInfoWindow, setShowInfoWindow] = useState<boolean[]>([]);

  const { user } = useUser();

  const getPositions = () => {
    socket?.emit('get locations');
  }

  const isMediumScreen = useIsMedium();

  const containerStyle = useMemo(() => ({
    width: isMediumScreen ? '50vw' : '90vw',
    height: '60vh',
    marginLeft: isMediumScreen ? '25vw' : '5vw'
  }), [isMediumScreen]);

  useEffect(() => {
    const updatePositions = (data: Location[]) => {
      setPositions(data);
    };

    if (!loadingSocket) {
      socket?.on("get locations", updatePositions);
      getPositions();
      return () => {
        socket?.off("get locations", updatePositions);
      };
    }
  }, [loadingSocket, socket, positionsRef.current]);

  const onLoad = useCallback(async function callback(map: any) {

    setMap(map)
  }, [])

  const onUnmount = useCallback(function callback(map: any) {
    setMap(null)
  }, [])

  if (locationAccessinfo !== "granted") return <LocationAccessInformation information={locationAccessinfo} />

  return isLoaded ? (
    <>
      <h1 className="row-start-6 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl text-center mb-4">
        <span className="text-transparent bg-clip-text bg-linear-to-r to-blue-900 from-teal-400">Friends&apos; locations</span></h1>
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
                    <p>User: {ciEquals(position.username!, props.user?.email) ? 'You' : position.username}</p>
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
    </>)
    : <></>
}

export default Locations;
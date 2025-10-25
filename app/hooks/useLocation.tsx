'use client';
import { useEffect, useRef, useState } from 'react';
import Location from '../types/location';
import { useUser } from './useUser';
import { useSocket } from './useSocket';

const useLocation = () => {
  const { user } = useUser();
  const { socket, loadingSocket } = useSocket();
  const [position, setPosition] = useState<Location>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: true,
    error: null,
    username: null,
    time: null
  });
  const positionRef = useRef(position);
  const socketRef = useRef(socket);
  const [locationAccessinfo, setLocationAccessinfo] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [socketReady, setSocketReady] = useState(false);

  const geolocationOptions: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  };

  useEffect(() => {
    if (!loadingSocket) setSocketReady(true);
  }, [loadingSocket, socket]);

  useEffect(() => {
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
        setLocationAccessinfo(permissionStatus.state as any);
        permissionStatus.onchange = () => setLocationAccessinfo(permissionStatus.state as any);
      });
    }
  }, []);

  useEffect(() => { socketRef.current = socket; }, [socket, loadingSocket]);
  useEffect(() => { positionRef.current = position; }, [position]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPosition(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }));
      return;
    }

    const handleSuccess = async (pos: GeolocationPosition) => {
      const newPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        loading: false,
        error: null,
        username: user?.email ?? null,
        time: new Date()
      };
      setPosition(newPosition);
      await socketRef.current?.emit('save location', newPosition);
    };

    const handleError = (error: GeolocationPositionError) => {
      const msg = error.message || (error.code === 2 ? 'Position unavailable' : 'Error retrieving location');
      setPosition(prev => ({ ...prev, loading: false, error: msg }));
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geolocationOptions);
    return () => navigator.geolocation.clearWatch(watchId);
  }, [socketReady, user?.email]);

  return { position, locationAccessinfo };
};

export default useLocation;
"use client";
import { useState, useEffect, useRef } from 'react';
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
  const [locationAccessinfo, setLocationAccessinfo] = useState('prompt');

  const geolocationOptions: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  };

  useEffect(() => {
    if (navigator.geolocation) {

      const queryPermissions = async () => {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationAccessinfo(permissionStatus.state);

          const handlePermissionChange = () => {
            setLocationAccessinfo(permissionStatus.state);
          };
          permissionStatus.onchange = handlePermissionChange;

          return () => {
            permissionStatus.onchange = null;
          };
        } catch (error) {
          console.error('Error while querying geolocation permissions:', error);
        }
      };
      queryPermissions();
    }
  }, []);

  useEffect(() => {
    if (!loadingSocket) {
      socketRef.current = socket;
    }
  }, [loadingSocket, socket]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPosition(prev => ({ ...prev, loading: false, error: "Geolocation is not supported by your browser." }));
      return;
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      if (typeof (position.coords.latitude) !== "number" || typeof (position.coords.longitude) !== "number") return;
      const newPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        loading: false,
        error: null,
        username: user?.email ?? null,
        time: new Date(Date.now())
      };
      setPosition(newPosition);
      if (socketRef.current)
        await socketRef.current.emit('save location', newPosition);
      else
        console.error("No socket");
    };

    const handleError = (error: GeolocationPositionError) => {
      setPosition(prev => ({ ...prev, loading: false, error: error.message }));
    };

    const getAndPublishLocation = async () => {
      navigator.geolocation.getCurrentPosition(await handleSuccess, handleError, geolocationOptions);
    }

    getAndPublishLocation();

    if (socketRef.current) {
      const intervalId = setInterval( () => {
        if (positionRef.current && socketRef.current) {
          getAndPublishLocation();
        }
      }, parseInt(process.env.NEXT_PUBLIC_LOCATION_INTERVAL!));
      return () => {
        clearInterval(intervalId);
      }
    }
  }, [socket?.connected]);

  return { position, locationAccessinfo };
};

export default useLocation;
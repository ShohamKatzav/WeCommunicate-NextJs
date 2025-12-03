"use client"
import { useState, useEffect } from 'react';
import Loading from './loading';

export default function OfflinePage() {

    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        setIsOnline(navigator.onLine);
    }, []);

    return <Loading />
}
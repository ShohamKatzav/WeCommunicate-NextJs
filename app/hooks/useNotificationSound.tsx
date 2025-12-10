"use client"
import { useEffect, useRef } from "react"
import { useSocket } from "./useSocket"

interface UseNotificationSoundOptions {
    event?: string // default: "notifications update"
    volume?: number // 0.0–1.0
}

export default function useNotificationSound(options: UseNotificationSoundOptions = {}) {
    const { event = "notifications update", volume = 0.5 } = options
    const soundRef = useRef<HTMLAudioElement | null>(null)
    const { socket } = useSocket();

    const isEmpty = (obj: any) => {
        for (const prop in obj) {
            if (Object.hasOwn(obj, prop)) {
                return false;
            }
        }
        return true;
    }
    useEffect(() => {

        if (!socket) return

        if (!soundRef.current) {
            soundRef.current = new Audio("/sounds/uh-oh.mp3")
            soundRef.current.volume = volume
        }

        const handleSound = (data: any) => {
            if (soundRef.current && !isEmpty(data)) {
                soundRef.current.currentTime = 0
                soundRef.current.play().catch(() => { })
            }
        }

        socket.on(event, handleSound)
        return () => {
            socket.off(event, handleSound);
        };
    }, [socket, event, volume])
}
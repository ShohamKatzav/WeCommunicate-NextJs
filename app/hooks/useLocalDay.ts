import { useSyncExternalStore } from "react";
import { startOfDay } from "../utils/dayLabel";

// The start of today in local time, moving on at midnight so labels such as
// "Today"/"Yesterday" stay right in a chat left open overnight. One timer is
// shared by every subscriber rather than one per day chip.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const getToday = () => startOfDay(new Date());

const notify = () => listeners.forEach(listener => listener());

// Recomputed from the clock each time rather than a fixed 24h interval, so a
// DST day (23 or 25 hours) still lands on midnight. A second past it, so the
// timer can't fire a hair early and see the old day.
const scheduleMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    timer = setTimeout(() => {
        notify();
        scheduleMidnight();
    }, nextMidnight - now.getTime() + 1000);
};

// A sleeping laptop or a throttled background tab can run the timer late,
// so coming back to the tab re-checks too. Listeners that see the same day
// don't re-render: useSyncExternalStore compares the snapshot.
const onVisible = () => {
    if (document.visibilityState === "visible") notify();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
        scheduleMidnight();
        document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        }
    };
};

const useLocalDay = () => useSyncExternalStore(subscribe, getToday, getToday);

export default useLocalDay;

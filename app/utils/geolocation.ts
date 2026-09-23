const EARTH_RADIUS_KM = 6371;

// The accuracy above which a pin is marked "(Not accurate)" on the map. Two
// fixes closer together than this are the same place as far as anyone looking
// at the map can tell, so it doubles as the "hasn't moved" threshold below.
export const NOT_ACCURATE_METERS = 200;

// A location is written to Mongo at most this often per account.
export const LOCATION_SAVE_INTERVAL_MS = 30_000;

export interface SavedFix {
    latitude: number;
    longitude: number;
    accuracy: number;
    at: number;
}

type LatLng = { lat: number; lng: number };

const toRad = (value: number) => (value * Math.PI) / 180;

export const getDistanceKm = (from: LatLng, to: LatLng) => {
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

// Whether a new fix shows the same thing on the map as one already saved. A
// phone sitting on a desk still reports a stream of slightly different fixes,
// and none of them change what the map shows. The one exception to "hasn't
// moved" is a pin going from "(Not accurate)" to accurate - that's a visible
// change even when the coordinates barely move (a cold iOS GPS lock does
// exactly this).
export const isSameSpot = (previous: SavedFix, next: SavedFix) => {
    const movedMeters = getDistanceKm(
        { lat: previous.latitude, lng: previous.longitude },
        { lat: next.latitude, lng: next.longitude }
    ) * 1000;
    const sharpened = previous.accuracy > NOT_ACCURATE_METERS && next.accuracy <= NOT_ACCURATE_METERS;

    return movedMeters < NOT_ACCURATE_METERS && !sharpened;
};

export const isTooSoon = (previous: SavedFix, next: SavedFix) =>
    next.at - previous.at < LOCATION_SAVE_INTERVAL_MS;

// Whether a new fix is worth persisting over the last one that was.
export const shouldPersistFix = (previous: SavedFix | null | undefined, next: SavedFix) =>
    !previous || (!isTooSoon(previous, next) && !isSameSpot(previous, next));

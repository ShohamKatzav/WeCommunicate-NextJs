// A pin attached to a chat message - a fixed snapshot of where the sender
// was when they pressed send, not a live position. Deliberately separate
// from types/location.ts, which is the continuously-updated presence a user
// broadcasts to the /locations map.
export default interface MessageLocation {
    latitude: number;
    longitude: number;
}

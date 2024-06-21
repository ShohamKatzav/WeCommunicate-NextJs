export default interface Location {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    loading: boolean;
    error: string | null;
    username: string | null;
    time: Date | null;
 }
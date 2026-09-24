// How long a login lasts - the JWT's expiresIn and the session cookie's
// maxAge. Push registrations can't outlive it either (see PushService).
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

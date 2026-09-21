// Samsung Internet's WebAPK pipeline is a different installer than Chrome's.
// Matching the browser token (not just "Samsung" in a device model) is what
// lets us serve it a GET share_target without also changing Chrome/Edge.
export function isSamsungInternet(userAgent: string | null | undefined): boolean {
    return /SamsungBrowser/i.test(userAgent ?? '');
}

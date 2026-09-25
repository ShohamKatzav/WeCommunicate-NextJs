import "server-only";
import { cookies, headers } from "next/headers";
import { createTranslator } from "./core";
import { messagesFor } from "./messages";
import { isLocale, Locale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, localeFromAcceptLanguage } from "./config";

// The cookie when there is one (an explicit choice, or the account's copied
// in at login), otherwise the browser's languages.
export const getLocale = async (): Promise<Locale> => {
    const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieValue)) return cookieValue;
    return localeFromAcceptLanguage((await headers()).get("accept-language"));
};

// For server components and server actions: messages returned to the client
// (validation errors, toasts) come back already in the viewer's language.
export const getT = async () => {
    const locale = await getLocale();
    return createTranslator(locale, messagesFor(locale));
};

// Server actions only - setting a cookie re-renders the current page, so
// <html lang dir> and the catalog switch in the same round trip.
export const setLocaleCookie = async (locale: Locale) => {
    (await cookies()).set({
        name: LOCALE_COOKIE,
        value: locale,
        path: "/",
        sameSite: "lax",
        secure: true,
        maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    });
};

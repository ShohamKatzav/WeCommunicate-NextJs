import { createTranslator } from "./core";
import { messagesFor } from "./messages";
import { DEFAULT_LOCALE, isLocale } from "./config";

// For copy written to someone other than whoever made the request - a push
// to a message's recipients, a call to its callee - in that person's own
// account language. Needs no request, so the socket server can use it too.
// Server-only in practice: importing it in a client component would bundle
// every catalog.
export const translatorFor = (locale: unknown) => {
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return createTranslator(resolved, messagesFor(resolved));
};

import { Locale } from "./config";
import { Translator, withFallback } from "./core";
import en from "./en";
import he from "./he";
import ar from "./ar";
import ru from "./ru";
import fr from "./fr";

export type Messages = typeof en;

const catalogs: Record<Locale, Messages> = { en, he, ar, ru, fr };

// Merged once per locale: every key present, English wherever a catalog
// lacks one.
const merged = new Map<Locale, Messages>();
export const messagesFor = (locale: Locale): Messages => {
    let messages = merged.get(locale);
    if (!messages) {
        messages = locale === "en" ? en : withFallback(en, catalogs[locale]);
        merged.set(locale, messages);
    }
    return messages;
};

// What helpers outside React take when they need to produce copy: the
// client's useT() and the server's getT() both return one.
export type TFunction = Translator<Messages>;

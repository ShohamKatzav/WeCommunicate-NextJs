import { ReactNode, Fragment, createElement } from "react";
import { DATE_LOCALES, Locale } from "./config";

// A message that changes with a number ("1 item" / "3 items"). Which forms
// a language needs comes from Intl.PluralRules: English uses one/other,
// Russian one/few/many/other, Arabic all six, Hebrew one/two/other.
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export const plural = (forms: Plural): Plural => forms;

export type MessageTree = { [key: string]: string | Plural | MessageTree };

const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);
const isPlural = (value: unknown): value is Plural =>
    typeof value === "object" && value !== null && "other" in value &&
    Object.keys(value).every(key => PLURAL_KEYS.has(key));

// "chat.composer.send" style keys for every leaf of the English tree, so a
// typo or a removed key is a compile error at the call site.
type Leaf = string | Plural;
export type MessageKey<T> = {
    [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string];

type Vars = Record<string, string | number>;

// A catalog with every key present, the English value filling in whatever
// the other one lacks.
export const withFallback = <T extends MessageTree>(base: T, overrides: MessageTree | undefined): T => {
    if (!overrides) return base;
    const merged: MessageTree = {};
    for (const [key, value] of Object.entries(base)) {
        const override = overrides[key];
        if (typeof value === "string") {
            merged[key] = typeof override === "string" ? override : value;
        } else if (isPlural(value)) {
            merged[key] = isPlural(override) ? override : value;
        } else {
            merged[key] = withFallback(value, typeof override === "object" && !isPlural(override) ? override : undefined);
        }
    }
    return merged as T;
};

const lookup = (messages: MessageTree, key: string): string | Plural | undefined => {
    let node: string | Plural | MessageTree | undefined = messages;
    for (const part of key.split(".")) {
        if (typeof node !== "object" || node === null || isPlural(node)) return undefined;
        node = (node as MessageTree)[part];
    }
    return typeof node === "string" || isPlural(node) ? node : undefined;
};

const interpolate = (text: string, vars?: Vars) =>
    vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match) : text;

export const createTranslator = <T extends MessageTree>(locale: Locale, messages: T) => {
    const pluralRules = new Intl.PluralRules(DATE_LOCALES[locale]);

    const resolve = (key: string, vars?: Vars): string => {
        const entry = lookup(messages, key);
        if (entry === undefined) {
            // Only reachable through a cast or a stale key; show the key so
            // it gets noticed rather than rendering nothing.
            if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing message: ${key}`);
            return key;
        }
        if (typeof entry === "string") return interpolate(entry, vars);
        const count = Number(vars?.count ?? 0);
        // A zero or two form, where a catalog has one, is used for exactly
        // that number even in a language whose plural rules don't have that
        // category (English "No items" rather than "0 items").
        const exact = count === 0 ? entry.zero : count === 2 ? entry.two : undefined;
        const form = exact ?? entry[pluralRules.select(count) as keyof Plural] ?? entry.other;
        return interpolate(form, vars);
    };

    const t = (key: MessageKey<T>, vars?: Vars): string => resolve(key, vars);

    // For a message with markup in it: "<b>{name}</b> is typing" with
    // { b: chunk => <strong>{chunk}</strong> }. Tags don't nest.
    const rich = (key: MessageKey<T>, parts: Record<string, string | number | ((chunk: string) => ReactNode)>): ReactNode => {
        const vars: Vars = {};
        for (const [name, value] of Object.entries(parts)) {
            if (typeof value !== "function") vars[name] = value;
        }
        const text = resolve(key, vars);
        const nodes: ReactNode[] = [];
        const tag = /<(\w+)>(.*?)<\/\1>/g;
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = tag.exec(text))) {
            if (match.index > last) nodes.push(text.slice(last, match.index));
            const render = parts[match[1]];
            nodes.push(typeof render === "function"
                ? createElement(Fragment, { key: nodes.length }, render(match[2]))
                : match[2]);
            last = tag.lastIndex;
        }
        if (last < text.length) nodes.push(text.slice(last));
        return createElement(Fragment, null, ...nodes);
    };

    return Object.assign(t, { rich, locale, dateLocale: DATE_LOCALES[locale] });
};

export type Translator<T extends MessageTree> = ReturnType<typeof createTranslator<T>>;

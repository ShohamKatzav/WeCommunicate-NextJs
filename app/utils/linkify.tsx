import { ReactNode } from "react";

// http(s) only, on purpose - matched below before any URL parsing happens,
// so a javascript: or data: scheme is never even a candidate, not just
// filtered out after the fact.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
// A URL at the end of a sentence commonly picks up trailing punctuation
// ("...see https://example.com/x." or "(https://example.com/x)") that isn't
// part of the link - stripped off here and left in the surrounding text.
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;

// Turns plain message text into text nodes + <a> nodes for any http(s) URL
// it contains, without dangerouslySetInnerHTML - the message body is user
// input, so it's split into React children instead of parsed as markup.
export function linkifyText(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
        const start = match.index ?? 0;
        const raw = match[0];
        const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? "";
        const candidate = trailing ? raw.slice(0, -trailing.length) : raw;
        if (!candidate) continue;

        let parsed: URL;
        try {
            parsed = new URL(candidate);
        } catch {
            continue;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;

        if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
        nodes.push(
            <a
                key={`link-${key++}`}
                href={parsed.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
            >
                {candidate}
            </a>
        );
        lastIndex = start + candidate.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return nodes;
}

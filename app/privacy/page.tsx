import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "../i18n/server";
import { pageTitleClassName } from "../components/shell/pageTitle";
import PageTitle from "../components/shell/fitTitle";

// When this policy last changed - update it with the text.
const LAST_UPDATED = new Date("2026-09-25T00:00:00Z");
const CONTACT_EMAIL = "shohamkatzav95@gmail.com";

// Each section in order, and the paragraphs (p) and bullet lists (ul) in it,
// by their keys under privacy.<section> in the catalogs.
type Block = { p: string } | { ul: string[] };
const SECTIONS: { id: string; blocks: Block[] }[] = [
    { id: "account", blocks: [{ p: "lead" }, { ul: ["contact", "password", "profile", "locale", "lastSeen", "blocked", "moderator", "moderation"] }, { p: "visible" }] },
    { id: "moderators", blocks: [{ p: "p1" }, { p: "p2" }] },
    { id: "messages", blocks: [{ p: "p1" }, { p: "p2" }] },
    { id: "media", blocks: [{ p: "voice" }, { p: "photo" }] },
    { id: "calls", blocks: [{ p: "p1" }, { p: "p2" }, { p: "p3" }, { p: "p4" }] },
    { id: "location", blocks: [{ p: "p1" }, { p: "p2" }, { p: "p3" }] },
    { id: "notifications", blocks: [{ p: "p1" }, { p: "p2" }] },
    { id: "moderation", blocks: [{ p: "p1" }, { p: "p2" }] },
    { id: "signIn", blocks: [{ p: "p1" }, { p: "p2" }, { p: "p3" }] },
    { id: "presence", blocks: [{ p: "p1" }] },
    { id: "device", blocks: [{ p: "p1" }, { p: "p2" }] },
    { id: "services", blocks: [{ p: "lead" }, { ul: ["mongo", "redis", "blob", "brevo", "openai", "google", "push", "turn"] }, { p: "notSold" }] },
    { id: "delete", blocks: [{ p: "p1" }, { p: "p2" }, { p: "p3" }] },
    { id: "contact", blocks: [{ p: "p1" }] },
];

export async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: t("privacy.metaTitle"), description: t("privacy.intro") };
}

const linkClassName = "font-medium text-primary underline underline-offset-2 hover:no-underline";

// Public, signed in or not (proxy.ts only guards /chat and friends). A plain
// reading page: one modest title, a jump list, then the sections as cards,
// readable in both themes and in right-to-left languages (logical ps-/start
// spacing). The bottom padding is larger than the top on purpose - the
// footer sits in normal flow with an upward shadow, and py-10 left the last
// card looking glued to it.
export default async function PrivacyPage() {
    const t = await getT();
    // Keys are built from SECTIONS above; the catalogs carry every one.
    const key = (path: string) => path as Parameters<typeof t>[0];
    const rich = (path: string) => t.rich(key(path), {
        email: CONTACT_EMAIL,
        b: chunk => <strong className="font-semibold text-foreground">{chunk}</strong>,
        edit: chunk => <Link href="/profile/edit" className={linkClassName}>{chunk}</Link>,
        mail: chunk => <a href={`mailto:${CONTACT_EMAIL}`} className={linkClassName}><bdi dir="ltr">{chunk}</bdi></a>,
    });
    const updated = LAST_UPDATED.toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

    return (
        <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 sm:pb-28">
            <header className="mb-14 text-center">
                <PageTitle className={pageTitleClassName}>
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-700 to-fuchsia-700 dark:from-violet-300 dark:to-fuchsia-400">
                        {t("privacy.title")}
                    </span>
                </PageTitle>
                <p className="mt-6 text-sm text-muted-foreground">{t("privacy.updated", { date: updated })}</p>
                <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("privacy.intro")}</p>
                <nav aria-label={t("privacy.contents")} className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-3 gap-y-2">
                    {SECTIONS.map(section => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="rounded-full border border-border/70 bg-card px-3 py-1 text-sm text-card-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
                        >
                            {t(key(`privacy.${section.id}.title`))}
                        </a>
                    ))}
                </nav>
            </header>

            <div className="space-y-4">
                {SECTIONS.map(section => (
                    <section
                        key={section.id}
                        id={section.id}
                        aria-labelledby={`${section.id}-title`}
                        className="scroll-mt-[calc(var(--content-top-offset)+0.75rem)] rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6"
                    >
                        <h2 id={`${section.id}-title`} className="text-lg font-bold sm:text-xl">
                            {t(key(`privacy.${section.id}.title`))}
                        </h2>
                        <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                            {section.blocks.map((block, index) => "p" in block
                                ? <p key={index}>{rich(`privacy.${section.id}.${block.p}`)}</p>
                                : (
                                    <ul key={index} className="list-disc space-y-1.5 ps-5 marker:text-muted-foreground">
                                        {block.ul.map(item => (
                                            <li key={item}>{rich(`privacy.${section.id}.items.${item}`)}</li>
                                        ))}
                                    </ul>
                                ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

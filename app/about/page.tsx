import Link from "next/link";
import CollapsibleSection from "../components/ui/collapsibleSection";
import { getT } from "../i18n/server";
import {
    MessageSquare,
    CheckCheck,
    Search,
    Reply,
    Mic,
    Timer,
    ShieldOff,
    WifiOff,
    Bell,
    MapPin,
    Share2,
    Image as ImageIcon,
} from "lucide-react";

const features = [
    { icon: MessageSquare, key: "chat" },
    { icon: CheckCheck, key: "receipts" },
    { icon: Search, key: "search" },
    { icon: Reply, key: "replies" },
    { icon: Mic, key: "voice" },
    { icon: ImageIcon, key: "media" },
    { icon: Timer, key: "disappearing" },
    { icon: ShieldOff, key: "blocking" },
    { icon: WifiOff, key: "offline" },
    { icon: Bell, key: "push" },
    { icon: Share2, key: "install" },
    { icon: MapPin, key: "location" },
] as const;

// Product names stay as they are in every language; only what they do is copy.
const techStack = [
    { title: "Next.js", key: "next" },
    { title: "Tailwind CSS", key: "tailwind" },
    { title: "Socket.IO", key: "socket" },
    { title: "MongoDB", key: "mongo" },
    { title: "Upstash Redis", key: "redis" },
    { title: "OpenAI API", key: "openai" },
    { title: "Vercel Blob", key: "blob" },
    { titleKey: "about.tech.serviceWorkersTitle", key: "serviceWorkers" },
    { title: "Brevo", key: "brevo" },
] as const;

const deploymentNotes = ["env", "scale", "socket"] as const;

const About = async () => {
    const t = await getT();
    return (
        <div className="relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <main className="max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-800 dark:from-blue-300 dark:to-indigo-400">{t("about.title")}</span><br />
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-800 dark:from-blue-300 dark:to-indigo-400">We-Communicate</span>
                        </h1>
                        <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
                            {t("about.intro")}
                        </p>
                    </div>
                </main>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Always visible - this is the part of the page worth
                    reading first, so it never sits behind a click. */}
                <section className="py-12">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {t("about.whatYouCanDo")}
                        </h2>
                        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                            {t("about.liveToday")}
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={feature.key}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-6 transform hover:scale-105 transition-transform duration-200"
                                >
                                    {/* Fixed square + rounded-full, and shrink-0 so it can
                                        never collapse into a full-width pill. w-12/h-12 is
                                        a size already used elsewhere in the app. */}
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {t(`about.features.${feature.key}.title`)}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                                        {t(`about.features.${feature.key}.description`)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* The longer background reading - collapsed so the page stays
                    scannable, with a teaser line so nothing is opaque. */}
                <section className="max-w-4xl mx-auto pt-4 pb-12 space-y-6">
                    <CollapsibleSection
                        title={t("about.builtWith")}
                        teaser={t("about.builtWithTeaser")}
                    >
                        <div className="grid sm:grid-cols-2 gap-4">
                            {techStack.map((tech) => (
                                <div
                                    key={tech.key}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 transform hover:scale-105 hover:shadow-md transition-all duration-200"
                                >
                                    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{"titleKey" in tech ? t(tech.titleKey) : tech.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{t(`about.tech.${tech.key}`)}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title={t("about.mission")}
                        teaser={t("about.missionTeaser")}
                    >
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {t("about.missionBody")}
                        </p>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title={t("about.deployment")}
                        teaser={t("about.deploymentTeaser")}
                    >
                        <div className="space-y-4">
                            {deploymentNotes.map((item) => (
                                <div
                                    key={item}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 transform hover:scale-105 hover:shadow-md transition-all duration-200"
                                >
                                    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{t(`about.deploymentNotes.${item}.title`)}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{t(`about.deploymentNotes.${item}.description`)}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title={t("about.journey")}
                        teaser={t("about.journeyTeaser")}
                    >
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                            {t("about.journeyBody1")}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {t("about.journeyBody2")}
                        </p>
                    </CollapsibleSection>
                </section>

                {/* Contact Section */}
                <section className="pb-12">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            {t("about.feedback")}
                        </p>
                        <Link
                            href="/contact"
                            className="inline-block bg-primary text-primary-foreground hover:opacity-90 font-semibold py-3 px-8 rounded-lg transform hover:scale-105 transition-all duration-200"
                        >
                            {t("about.getInTouch")}
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default About;

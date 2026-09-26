import Link from "next/link";
import { MessageSquare, Mic, Timer, WifiOff, ShieldOff, Search } from "lucide-react";
import { getT } from "./i18n/server";
import { pageTitleClassName } from "./components/shell/pageTitle";
import PageTitle from "./components/shell/fitTitle";

// Logged-in visitors never reach this page - proxy.ts treats "/" as a public
// login route and redirects them straight to /chat - so this only ever has to
// speak to someone who is logged out. That makes "Log in" the primary action.
const highlights = [
    { icon: MessageSquare, key: "messaging" },
    { icon: Mic, key: "voice" },
    { icon: Search, key: "search" },
    { icon: Timer, key: "disappearing" },
    { icon: WifiOff, key: "offline" },
    { icon: ShieldOff, key: "safety" },
] as const;

const Home = async () => {
    const t = await getT();
    return (
        <div className="px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <section className="max-w-4xl mx-auto pb-12 text-center">
                <PageTitle className={pageTitleClassName}>
                    <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-800 from-pink-700 dark:to-indigo-400 dark:from-pink-300">
                        WeCommunicate
                    </span>
                </PageTitle>
                <p className="mt-5 max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-300">
                    {t("home.tagline")}
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                    {/* Fixed width on both buttons (rather than px-* sizing to
                        content) so "Log in" and "Create an account" render the
                        same size - letting them differ made the pair look
                        lopsided even though the flex row itself was centered. */}
                    <Link
                        href="/login"
                        className="w-full sm:w-64 text-center inline-block bg-primary text-primary-foreground hover:opacity-90 text-lg font-semibold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                        {t("home.logIn")}
                    </Link>
                    <Link
                        href="/sign-up"
                        className="w-full sm:w-64 text-center inline-block border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                    >
                        {t("home.createAccount")}
                    </Link>
                </div>
            </section>

            {/* Highlights */}
            <section className="max-w-6xl mx-auto pb-12">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {highlights.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.key}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-5 transform hover:scale-105 transition-transform duration-200"
                            >
                                <div className="w-12 h-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3">
                                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    {t(`home.highlights.${item.key}.title`)}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {t(`home.highlights.${item.key}.description`)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default Home;

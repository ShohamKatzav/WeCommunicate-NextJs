import Link from "next/link";
import { MessageSquare, Mic, Timer, WifiOff, ShieldOff, Search } from "lucide-react";

// Logged-in visitors never reach this page - proxy.ts treats "/" as a public
// login route and redirects them straight to /chat - so this only ever has to
// speak to someone who is logged out. That makes "Log in" the primary action.
const highlights = [
    {
        icon: MessageSquare,
        title: "Real-time messaging",
        description: "Direct and group chats that land instantly, with typing indicators and read receipts.",
    },
    {
        icon: Mic,
        title: "Voice messages",
        description: "Record and send a voice note straight from the browser.",
    },
    {
        icon: Search,
        title: "Search everything",
        description: "Find any message across your conversations as you type.",
    },
    {
        icon: Timer,
        title: "Disappearing messages",
        description: "Put a conversation on a 24-hour or 7-day timer.",
    },
    {
        icon: WifiOff,
        title: "Works offline",
        description: "Messages queue up in a visible outbox and send themselves when you reconnect.",
    },
    {
        icon: ShieldOff,
        title: "Safety built in",
        description: "Block anyone instantly, backed by automatic content moderation.",
    },
];

const Home = () => {
    return (
        <div className="px-4 sm:px-6 lg:px-8">
            {/* Hero */}
            <section className="max-w-4xl mx-auto text-center pt-6 pb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    <span className="text-transparent bg-clip-text bg-linear-to-r to-indigo-800 from-pink-700 dark:to-indigo-400 dark:from-pink-300">
                        We Communicate
                    </span>
                </h1>
                <p className="mt-5 max-w-2xl mx-auto text-lg sm:text-xl text-gray-600 dark:text-gray-300">
                    A real-time chat app with voice notes, disappearing messages and full offline
                    support - free, and right in your browser.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                    {/* Fixed width on both buttons (rather than px-* sizing to
                        content) so "Log in" and "Create an account" render the
                        same size - letting them differ made the pair look
                        lopsided even though the flex row itself was centered. */}
                    <Link
                        href="/login"
                        className="w-full sm:w-64 text-center inline-block bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                        Log in
                    </Link>
                    <Link
                        href="/sign-up"
                        className="w-full sm:w-64 text-center inline-block border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 text-lg font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                    >
                        Create an account
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
                                key={item.title}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-5 transform hover:scale-105 transition-transform duration-200"
                            >
                                <div className="w-12 h-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3">
                                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    {item.title}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {item.description}
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

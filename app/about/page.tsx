import Link from "next/link";
import CollapsibleSection from "../components/collapsibleSection";
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
    {
        icon: MessageSquare,
        title: "Real-time chat",
        description: "One-to-one and group conversations that arrive instantly, with typing indicators and live online status.",
    },
    {
        icon: CheckCheck,
        title: "Delivery & read receipts",
        description: "See at a glance whether your message was sent or actually read, right on the bubble.",
    },
    {
        icon: Search,
        title: "Search your history",
        description: "Search across every message in your own conversations as you type, with matches previewed in the sidebar.",
    },
    {
        icon: Reply,
        title: "Replies & quotes",
        description: "Reply to a specific message and the quoted text travels with it, so group threads stay readable.",
    },
    {
        icon: Mic,
        title: "Voice messages",
        description: "Record and send a voice note straight from the browser - no app install, no extra permissions beyond the mic.",
    },
    {
        icon: ImageIcon,
        title: "Photos, video & files",
        description: "Share images, audio, video and documents. Large photos are compressed in your browser before they ever upload.",
    },
    {
        icon: Timer,
        title: "Disappearing messages",
        description: "Turn on a 24-hour or 7-day timer per conversation and new messages clean themselves up automatically.",
    },
    {
        icon: ShieldOff,
        title: "Block & moderation",
        description: "Block anyone to stop their messages and hide your online status from them, backed by automatic content moderation.",
    },
    {
        icon: WifiOff,
        title: "Works offline",
        description: "Messages written offline are queued in a visible outbox and sent the moment you are back on a connection.",
    },
    {
        icon: Bell,
        title: "Push notifications",
        description: "Get notified about new messages even when the tab is closed, with per-conversation unread counts.",
    },
    {
        icon: Share2,
        title: "Install as an app",
        description: "Install WeCommunicate as a PWA and share links or photos into it straight from your device share sheet.",
    },
    {
        icon: MapPin,
        title: "Location sharing",
        description: "Opt in to share your location and see how far away your friends are on a live map.",
    },
];

const techStack = [
    {
        title: "Next.js",
        description: "Server-side rendering, server actions and efficient routing for a seamless user experience.",
    },
    {
        title: "Tailwind CSS",
        description: "Utility-first CSS framework for designing a responsive and aesthetically pleasing interface.",
    },
    {
        title: "Socket.IO",
        description: "Enabling real-time communication and facilitating instant dynamic interactions.",
    },
    {
        title: "MongoDB",
        description: "Scalable and flexible database handling, including TTL-based cleanup for disappearing messages.",
    },
    {
        title: "Upstash Redis",
        description: "Real-time notifications and online status tracking, ensuring instant updates without heavy backend load.",
    },
    {
        title: "OpenAI API",
        description: "Advanced content moderation system to maintain community safety and ensure appropriate communication.",
    },
    {
        title: "Vercel Blob",
        description: "Storage for images, documents and voice notes, uploaded straight from the browser.",
    },
    {
        title: "Service Workers & Web Push",
        description: "Offline queueing, installable PWA support and notifications that arrive even with the tab closed.",
    },
    {
        title: "Brevo",
        description: "Delivers the email and SMS verification codes behind sign-up and password reset.",
    },
];

const deploymentNotes = [
    {
        title: "Environment Configuration",
        description: "Secure management of sensitive data through environment variables.",
    },
    {
        title: "Scalability",
        description: "Auto-scaling capabilities for handling varying levels of traffic.",
    },
    {
        title: "Socket.IO Support",
        description: "Reliable WebSocket support for real-time communication features.",
    },
];

const About = () => {
    return (
        <div className="relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <main className="max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-800 dark:from-blue-300 dark:to-indigo-400">About</span><br />
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-800 dark:from-blue-300 dark:to-indigo-400">We-Communicate</span>
                        </h1>
                        <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
                            A real-time chat app built from scratch - messaging, voice notes, offline support and more,
                            running end to end on free-tier infrastructure.
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
                            What You Can Do
                        </h2>
                        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                            Everything below is live in the app today.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={feature.title}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 p-6 transform hover:scale-105 transition-transform duration-200"
                                >
                                    {/* Fixed square + rounded-full, and shrink-0 so it can
                                        never collapse into a full-width pill. w-12/h-12 is
                                        a size already used elsewhere in the app. */}
                                    <div className="w-12 h-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                                        {feature.description}
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
                        title="Built With"
                        teaser="Next.js, Socket.IO, MongoDB, Redis, Vercel Blob and more"
                    >
                        <div className="grid sm:grid-cols-2 gap-4">
                            {techStack.map((tech) => (
                                <div
                                    key={tech.title}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 transform hover:scale-105 hover:shadow-md transition-all duration-200"
                                >
                                    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{tech.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{tech.description}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="My Mission"
                        teaser="Why I built this, and what I wanted to learn from it"
                    >
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            I built WeCommunicate as a way to challenge myself and deepen my understanding of modern web technologies.
                            My goal was to explore real-time communication, data management, and deployment - and to turn that learning
                            process into something functional and meaningful. This project reflects my curiosity and drive to grow as a developer,
                            while building tools that make connecting online feel simple and natural.
                        </p>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Deployment with Render"
                        teaser="How it runs in production, from env config to WebSocket support"
                    >
                        <div className="space-y-4">
                            {deploymentNotes.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 transform hover:scale-105 hover:shadow-md transition-all duration-200"
                                >
                                    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{item.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="My Journey as a Developer"
                        teaser="What building this end to end actually taught me"
                    >
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                            WeCommunicate is more than a project; it&apos;s a personal expedition through the realms of full-stack development.
                            From the initial concept to the final deployment, each phase has been a deep dive into the intricacies of web development.
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            This project was a gateway for me to explore new technologies like Next.js and Socket.IO while honing my skills in familiar ones.
                            It represents my continuous quest for knowledge and my unwavering passion for technology.
                        </p>
                    </CollapsibleSection>
                </section>

                {/* Contact Section */}
                <section className="pb-12">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Your feedback and suggestions are vital to the growth and improvement of WeCommunicate.
                            I am always open to hearing your thoughts and experiences.
                        </p>
                        <Link
                            href="/contact"
                            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transform hover:scale-105 transition-all duration-200"
                        >
                            Get in Touch
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default About;

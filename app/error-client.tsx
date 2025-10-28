"use client";
import { useRouter } from "next/navigation";
import { ServerCrash, Wrench, RefreshCw } from "lucide-react";

export default function ErrorClient() {
    const router = useRouter();

    const handleBackToChat = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        fetch(form.action, { method: 'POST' })
            .then(() => {
                window.location.href = '/chat';
            });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-rose-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 text-center p-6">
            <div className="animate-pulse">
                <ServerCrash className="w-24 h-24 text-rose-600 dark:text-rose-400" />
            </div>

            <h1 className="mt-6 text-5xl font-extrabold text-gray-900 dark:text-white">
                505 — Server had a meltdown 💻🔥
            </h1>

            <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 max-w-md">
                Our chat server just rage-quit mid-conversation. We're giving it a coffee and a pep talk ☕💬
            </p>

            <p className="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                “Even servers need a mental health day.” — SysAdmin proverb
            </p>

            <div className="flex gap-3 mt-8">
                <button
                    onClick={() => router.refresh()}
                    className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-md transition-all"
                >
                    <RefreshCw className="w-5 h-5" />
                    Try again
                </button>

                <form action="/" method="POST" onSubmit={handleBackToChat}>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
                    >
                        <Wrench className="w-5 h-5" />
                        Back to chat
                    </button>
                </form>

            </div>
        </div>
    );
}
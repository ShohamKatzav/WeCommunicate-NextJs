"use client"
import { useRouter } from "next/navigation";
import { MessageCircleOff, Ghost, MessageSquareHeart } from "lucide-react";

export default function NotFoundClient() {
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 text-center p-6">
            <div className="animate-bounce">
                <Ghost className="w-24 h-24 text-lime-600 dark:text-lime-400" />
            </div>

            <h1 className="mt-6 text-5xl font-extrabold text-gray-900 dark:text-white">
                404 — Chat not found 💬
            </h1>

            <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 max-w-md">
                Looks like this chat has <span className="font-semibold">ghosted</span> you 👻
            </p>

            <p className="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
                "Even unread messages deserve closure." — Anonymous
            </p>

            <div className="flex gap-3 mt-8">
                <form action="/" method="POST" onSubmit={handleBackToChat}>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-3 bg-lime-600 hover:bg-lime-700 text-white rounded-xl font-semibold shadow-md transition-all"
                    >
                        <MessageSquareHeart className="w-5 h-5" />
                        Back to chat
                    </button>
                </form>

                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
                >
                    <MessageCircleOff className="w-5 h-5" />
                    Go back
                </button>
            </div>
        </div>
    );
}
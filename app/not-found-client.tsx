"use client"
import { useRouter } from "next/navigation";
import { MessageCircleOff, Ghost, MessageSquareHeart } from "lucide-react";
import { useT } from "./i18n/client";

export default function NotFoundClient() {
    const router = useRouter();
    const t = useT();

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
                {t("errorPages.notFoundTitle")}
            </h1>

            <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 max-w-md">
                {t.rich("errorPages.notFoundBody", { b: chunk => <span className="font-semibold">{chunk}</span> })}
            </p>

            <p className="mt-2 text-sm italic text-muted-foreground">
                {t("errorPages.notFoundQuote")}
            </p>

            <div className="flex gap-3 mt-8">
                <form action="/" method="POST" onSubmit={handleBackToChat}>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-5 py-3 bg-lime-700 hover:bg-lime-800 text-white rounded-xl font-semibold shadow-md transition-all"
                    >
                        <MessageSquareHeart className="w-5 h-5" />
                        {t("errorPages.backToChat")}
                    </button>
                </form>

                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
                >
                    <MessageCircleOff className="w-5 h-5" />
                    {t("errorPages.goBack")}
                </button>
            </div>
        </div>
    );
}
"use client";
import { MapPin } from "lucide-react";
import { LocationAccess } from "../../hooks/useLocation";
import { useT } from "../../i18n/client";

const bold = (chunk: string) => <strong>{chunk}</strong>;

interface LocationAccessInformationProps {
    information: LocationAccess;
    hasFix: boolean;
    locating: boolean;
    error: string | null;
    // Wired straight to a button's onClick - it has to run inside the tap for
    // iOS Safari to show its permission prompt.
    onEnable: () => void;
}

const linkClass = "font-medium text-blue-600 underline dark:text-blue-400 hover:no-underline";

const EnableButton = ({ onEnable, locating, label }: { onEnable: () => void; locating: boolean; label: string }) => {
    const t = useT();
    return (
    <button
        type="button"
        onClick={onEnable}
        disabled={locating}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
    >
        {locating
            ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            : <MapPin size={16} />}
        {locating ? t("locations.access.locating") : label}
    </button>
    );
};

const LocationAccessInformation = ({ information, hasFix, locating, error, onEnable }: LocationAccessInformationProps) => {
    const t = useT();
    if (information === "checking") return null;

    if (information === "unsupported") {
        return (
            <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {t("locations.access.unsupported")}
            </p>
        );
    }

    if (information === "granted") {
        // Timeouts and "position unavailable" land here - permission is fine,
        // the fix just didn't come. Only worth mentioning without a pin.
        if (hasFix || !error || locating) return null;
        return (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
                <p>{t("locations.access.couldntGet", { error })}</p>
                <EnableButton onEnable={onEnable} locating={locating} label={t("locations.access.tryAgain")} />
            </div>
        );
    }

    if (information === "prompt") {
        return (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{t("locations.access.promptTitle")}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t("locations.access.promptBody")}
                    </p>
                    {error && <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>}
                </div>
                <EnableButton onEnable={onEnable} locating={locating} label={t("locations.access.enable")} />
            </div>
        );
    }

    return (
        <div className="mb-4 space-y-4 rounded-xl border border-red-200 bg-white p-4 shadow-xs dark:border-red-900 dark:bg-gray-900">
            <div className="space-y-1">
                <p className="font-semibold text-gray-900 dark:text-white">{t("locations.access.blockedTitle")}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("locations.access.blockedBody")}
                </p>
            </div>

            <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                <p className="font-semibold">{t("locations.access.safari")}</p>
                <ol className="list-decimal space-y-1 ps-5">
                    <li>{t.rich("locations.access.safariStep1", { b: bold })}</li>
                    <li>{t.rich("locations.access.safariStep2", { b: bold })}</li>
                </ol>
                <p className="text-gray-600 dark:text-gray-400">
                    {t("locations.access.safariNote")}
                </p>
            </div>

            <div className="space-y-2 text-sm">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{t("locations.access.otherBrowsers")}</p>
                <ul className="space-y-1">
                    <li>
                        <a href={`https://support.google.com/chrome/answer/142065?hl=${t.locale}`} className={linkClass} target="_blank" rel="noopener noreferrer">
                            {t("locations.access.chromeGuide")}
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://support.microsoft.com/en-gb/microsoft-edge/location-and-privacy-in-microsoft-edge-31b5d154-0b1b-90ef-e389-7c7d4ffe7b04"
                            className={linkClass}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {t("locations.access.edgeGuide")}
                        </a>
                    </li>
                </ul>
            </div>

            <EnableButton onEnable={onEnable} locating={locating} label={t("locations.access.tryAgain")} />
        </div>
    );
};

export default LocationAccessInformation;

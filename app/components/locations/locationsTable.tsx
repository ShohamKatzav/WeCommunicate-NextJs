import { MapPinOff } from "lucide-react";
import { AsShortName } from "../../utils/stringFormat";
import { useT } from "../../i18n/client";

export interface FriendDistanceRow {
    username: string;
    distanceText: string;
    distanceKm: number | null;
    accuracy: number | null;
    updatedAt: string;
}

interface LocationsTableProps {
    friendsWithDistance: FriendDistanceRow[];
}

const LocationsTable = ({ friendsWithDistance }: LocationsTableProps) => {
    const t = useT();
    return (
        friendsWithDistance.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
                <MapPinOff size={28} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("locations.table.empty")}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">{t("locations.table.emptyHint")}</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-start text-xs sm:text-sm">
                    <thead className="border-b border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="px-2 py-2 font-semibold sm:px-3">{t("locations.table.friend")}</th>
                            <th className="px-2 py-2 font-semibold sm:px-3">{t("locations.table.distance")}</th>
                            <th className="px-2 py-2 font-semibold sm:px-3">{t("locations.table.updated")}</th>
                            <th className="px-2 py-2 font-semibold sm:px-3">{t("locations.table.accuracy")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {friendsWithDistance.map(friend => (
                            <tr key={friend.username} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                                <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-100 sm:px-3">{AsShortName(friend.username)}</td>
                                <td className="px-2 py-2 text-gray-700 dark:text-gray-200 sm:px-3">{friend.distanceText}</td>
                                <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-300 sm:px-3">{friend.updatedAt}</td>
                                <td className="px-2 py-2 sm:px-3">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${friend.accuracy != null && friend.accuracy <= 200
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                        }`}>
                                        {friend.accuracy != null
                                            ? new Intl.NumberFormat(t.dateLocale, { style: "unit", unit: "meter", maximumFractionDigits: 0 }).format(Math.round(friend.accuracy))
                                            : t("locations.unknown")}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    )
}

export default LocationsTable;

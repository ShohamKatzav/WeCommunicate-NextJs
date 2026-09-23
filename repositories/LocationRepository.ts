import Account from "../models/Account";
import Location from "../models/Location";
import { Types } from "mongoose";

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    error: string;
    time: Date;
    accountId: Types.ObjectId;
    username?: string;
}
export default class LocationRepository {

    static async getLocationsWithUsernames(locations: LocationData[]) {
        try {
            const accountIds = locations.map((item: LocationData) => item.accountId);
            const accounts = await Account.find({ _id: { $in: accountIds } }).select('email').exec();

            const emailMap = new Map();
            accounts.forEach(account => {
                emailMap.set(account._id.toString(), account.email);
            });

            return locations.map((item: LocationData) => {
                const username = emailMap.get(item?.accountId?.toString());
                return { ...item, username };
            });
        } catch (err) {
            console.error('Failed to get usernames for locations:', err);
            throw err;
        }
    }

    static async getLocations() {
        try {
            // Filter to accounts that have a location set, and only project
            // the fields actually used below, instead of loading every field
            // (including password hashes) of every account.
            const accounts = await Account.find({ location: { $exists: true } })
                .select('_id location')
                .populate({ path: 'location', select: 'latitude longitude accuracy error time' })
                .exec();
            const filteredAccounts = accounts.filter(account => account.location);
            const locations: LocationData[] = filteredAccounts.map((account) => {
                const { latitude, longitude, accuracy, error, time } = account.location;
                return { latitude, longitude, accuracy, error, time, accountId: account._id };
            });

            return await this.getLocationsWithUsernames(locations);
        } catch (err) {
            console.error('Could not get locations:', err);
            throw err;
        }
    }

    static async updateLocation(
        accountId: Types.ObjectId,
        location: Omit<LocationData, 'accountId'>,
        currentLocationId?: Types.ObjectId | null
    ) {
        try {
            // A single atomic upsert instead of a manual "read, then decide
            // update-vs-create" guarded by an in-memory lock. That lock never
            // worked across multiple server processes, and - worse - silently
            // dropped the update entirely (no error, no retry) whenever it
            // happened to already be held. Keying the upsert directly on
            // `account` is also more correct than the old approach if
            // Account.location and the actual Location document ever drifted
            // out of sync: this always finds (or creates) the one Location
            // document that really belongs to this account.
            const savedLocation = await Location.findOneAndUpdate(
                { account: accountId },
                { ...location, account: accountId },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // After the first save the account already points here - no
            // need to rewrite it on every location update.
            if (!currentLocationId || !savedLocation._id.equals(currentLocationId)) {
                await Account.updateOne({ _id: accountId }, {
                    $set: { location: savedLocation._id }
                });
            }

            const { latitude, longitude, accuracy, error, time } = savedLocation;
            return { latitude, longitude, accuracy, error, time };
        } catch (err) {
            console.error('Failed to update location:', err);
            throw err;
        }
    }
}
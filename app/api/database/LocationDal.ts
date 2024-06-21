import Account from "../models/Account";
import { Types } from 'mongoose';

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    error: string;
    time: Date;
    accountId?: Types.ObjectId;
    username?: string;
}

export default class LocationRepository {

    static async findLocation(accountId: Types.ObjectId) {
        try {
            return await Account.findById(accountId, 'location').exec();
        } catch (err) {
            console.error('Failed to find location for this accountID:', err);
            throw err;
        }
    }
    static async getLocationsWithUsernames(locations: LocationData[]) {
        try {
            const accountIds = locations.map((item: LocationData) => item.accountId);
            const accounts = await Account.find({ _id: { $in: accountIds } }).select('email');

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
            const accounts = await Account.find().select('location');
            // filtering out undefined locations
            const filteredAccounts = accounts.filter(account => account.location);
            const locations: LocationData[] = filteredAccounts.map((account) => {
                const accountId = account._id;
                const { latitude, longitude, accuracy, error, time } = account.location;
                return { latitude, longitude, accuracy, error, time, accountId };
            });
            return await this.getLocationsWithUsernames(locations);
        } catch (err) {
            console.error('Could not get loctions:', err);
            throw err;
        }
    }
    static async updateLocation(accountId: Types.ObjectId, location: Location) {
        const { latitude, longitude, accuracy, error, time } = location;
        try {
            return await Account.updateOne({ _id: accountId },
                {
                    $set: {
                        location: {
                            latitude: latitude, longitude: longitude, accuracy: accuracy,
                            error: error ?? 'No error occurred', time: time
                        }
                    }
                });
        } catch (err) {
            console.error('Failed to update location:', err);
            throw err;
        }
    }
}
import Account from "../models/Account";
import Location from "../models/Location";
import mongoose, { Types } from 'mongoose';

interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    error: string;
    time: Date;
    accountId: Types.ObjectId;
    username?: string;
}
const lockMap: { [key: string]: boolean } = {};

export default class LocationRepository {
    static async findLocation(accountId: Types.ObjectId) {
        try {
            return await Account.findById(accountId).populate('location').exec();
        } catch (err) {
            console.error('Failed to find location for this accountID:', err);
            throw err;
        }
    }

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
            const accounts = await Account.find().populate('location').exec();
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

    static async updateLocation(accountId: Types.ObjectId, location: LocationData): Promise<void> {
        const accountLockKey = accountId.toString();
    
        if (lockMap[accountLockKey]) {
            return;
        }
    
        lockMap[accountLockKey] = true;
    
        try {
            const account = await Account.findById(accountId).populate('location').exec();
            if (!account) {
                throw new Error(`Account with ID ${accountId} not found`);
            }
    
            let locationId;
    
            if (account.location) {
                // Update the existing location
                await Location.updateOne({ _id: account.location._id }, {
                    ...location,
                    account: accountId
                });
                locationId = account.location._id;
            } else {
                // Create a new location if one doesn't exist
                const savedLocation = await Location.create({
                    ...location,
                    account: accountId
                });
                locationId = savedLocation._id;
            }
    
            await Account.updateOne({ _id: accountId }, {
                $set: { location: locationId }
            });
    
        } catch (err) {
            console.error('Failed to update location:', err);
            throw err;
        } finally {
            delete lockMap[accountLockKey];
        }
    }
}
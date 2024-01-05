const Location = require("../models/Location");

const AccountRepository = require("../database/AccountDal");
const accountRepo = new AccountRepository();

class LocationRepository {

    async findLocation(accountId) {
        try {
            return await Location.findOne({
                accountID: accountId
            });
        } catch (err) {
            console.error('Failed to find location for this accountID:', err);
            throw err;
        }
    }

    async getLocationsWithUsernames(locations) {
        const locationsWithUsernames = [];
    
        for (const item of locations) {
            const username = await accountRepo.getEmailById(item.accountID);
            locationsWithUsernames.push({ ...item._doc, username });
        }
        return locationsWithUsernames;
    }

    async getLocations() {
        try {
            const loctions = await Location.find().exec();
            const locationsWithUsernames = await this.getLocationsWithUsernames(loctions);
            const loctionsToSend = locationsWithUsernames.map(item => {
                return {
                    latitude: item.latitude,
                    longitude: item.longitude,
                    accuracy: item.accuracy,
                    error: item.error,
                    time: item.time,
                    username: item.username
                };
            });
            return loctionsToSend;
        } catch (err) {
            console.error('Could not get loctions:', err);
            throw err;
        }
    }

    async updateLocation(accountId, location) {
        const { latitude, longitude, accuracy, error, time } = location;
        try {
            return await Location.updateOne({ accountID: accountId },
                {
                    $set: {
                        latitude: latitude, longitude: longitude, accuracy: accuracy,
                        error: error ?? 'No error occurred', time: time
                    }
                });
        } catch (err) {
            console.error('Failed to update location:', err);
            throw err;
        }
    }

    async createLocation(accountId, location) {
        const { latitude, longitude, accuracy, error, time } = location;
        const newDoc = {
            latitude : latitude,
            longitude: longitude,
            accuracy: accuracy,
            error: error ?? 'No error occurred',
            accountID: accountId,
            time: time
        }
        try {
            return await Location.create(newDoc);
        } catch (err) {
            console.error('Failed to create location:', err);
            throw err;
        }
    }
}

module.exports = LocationRepository;
const LocationRepository = require("../database/LocationDal");
const locationRepo = new LocationRepository();

const AccountRepository = require("../database/AccountDal");
const accountRepo = new AccountRepository();


const getLocations = async () => {
    try {
        locations = await locationRepo.getLocations();
        return ({ statusCode: 200, data: { message: "success", locations } });
    } catch (err) {
        console.error('Failed to retrieve messages:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
};

const updateLocation = async (email, location) => {
    try {
        const user = await accountRepo.getUserByEmail(email);
        const existLocation = await locationRepo.findLocation(user._id);
        const updatedDocument = existLocation ?
            await locationRepo.updateLocation(user._id, location)
            : await locationRepo.createLocation(user._id, location);
        return ({ statusCode: 200, data: { message: "success", updatedDocument } });
    } catch (err) {
        console.error('Failed to update location:', err);
        return ({ statusCode: 500, data: { error: "Internal Server Error" } });
    }
};


module.exports = {
    getLocations,
    updateLocation
};
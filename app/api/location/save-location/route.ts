import AccountRepository from "../../database/AccountDal"
import LocationRepository from "../../database/LocationDal";
import dbConnect from "../../database/MongoDb";

export default async function SaveLocations(location: any) {
    try {
        await dbConnect();
        const account = await AccountRepository.getUserByEmail(location.username);
        return await LocationRepository.updateLocation(account._id, location);
    } catch (err) {
        console.error('Failed to save location:', err);
        throw err;
    }

}

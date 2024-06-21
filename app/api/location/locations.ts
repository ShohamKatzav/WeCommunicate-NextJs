import dbConnect from "../database/MongoDb";
import AccountRepository from "../database/AccountDal"
import LocationRepository from "../database/LocationDal";

export async function GetLocations() {
    try {
        await dbConnect();
        return await LocationRepository.getLocations();
    }  catch (err) {
      console.error('Failed to retrieve locations:', err);
      throw err;
    }
}
export async function SaveLocations(location: any) {
    try {
        await dbConnect();
        const account = await AccountRepository.getUserByEmail(location.username);
        return await LocationRepository.updateLocation(account._id, location);
    } catch (err) {
        console.error('Failed to save location:', err);
        throw err;
    }
}

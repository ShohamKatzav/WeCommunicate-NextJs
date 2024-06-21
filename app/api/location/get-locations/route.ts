import LocationRepository from "../../database/LocationDal";
import dbConnect from "../../database/MongoDb";

export default async function GetLocations() {
    try {
        await dbConnect();
        return await LocationRepository.getLocations();
    }  catch (err) {
      console.error('Failed to retrieve locations:', err);
      throw err;
    }
}

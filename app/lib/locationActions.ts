import dbConnect from "./MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import LocationRepository from "@/repositories/LocationRepository";

export async function GetLocations() {
    try {
        await dbConnect();
        return await LocationRepository.getLocations();
    } catch (err) {
        console.error('Failed to retrieve locations:', err);
        throw err;
    }
}
export async function SaveLocations(email: string, location: any) {
    try {
        await dbConnect();
        // The account a location is saved against always comes from the
        // caller's verified identity, never from a client-supplied
        // "username" field - otherwise any socket client could overwrite
        // another user's location.
        const account = await AccountRepository.getUserByEmail(email);
        if (!account) throw new Error(`Account not found for ${email}`);
        const saved = await LocationRepository.updateLocation(account._id, { ...location, username: email }, account.location);
        return { ...saved, username: account.email };
    } catch (err) {
        console.error('Failed to save location:', err);
        throw err;
    }
}

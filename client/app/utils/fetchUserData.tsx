import { get } from "./cookie-actions";
import User from '../types/user'

const FetchUserData = async () => {
    var user: User = {};
    try {
        const userString = await get();
        if (userString?.value.trim()) {
            user = JSON.parse(userString!.value);
        } else {
            //console.error("No user data found in cookies");
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    } finally {
        return user;
    }
}

export default FetchUserData;
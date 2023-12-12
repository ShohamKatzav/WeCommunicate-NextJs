import { get } from "./cookie-actions";
import User from '../types/user'

var loading: boolean = true;

const useFetchUserData = async () => {
    try {
        const userString = await get(); // Use await here
        var user: User = {};

        if (userString?.value.trim()) {
            user = JSON.parse(userString!.value);
            // Now you can use the 'user' variable safely.
        } else {
            // Handle the case when the value is undefined (optional)
            console.error("No user data found in cookies");
        }
        return user;

    } catch (error) {
        console.error("Error fetching user data:", error);
    } finally {
        loading = false;
    }

}

export function isLoading() {
    return loading;
}

export default useFetchUserData;
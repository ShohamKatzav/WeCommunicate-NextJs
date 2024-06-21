'use client';
import AxiosWithAuth from "../utils/axiosWithAuth";

async function fetchMessages(page: number, email: string) {
    if (typeof page !== 'number' || page < 1) {
        //console.error("Invalid page number");
        return [];
    }
    if (typeof email !== 'string' || email.trim() === '') {
        //console.error("Invalid email address");
        return [];
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";
    const perPage = 5;

    try {
        const response = await AxiosWithAuth().get(`${baseUrl}/get-data`, {
            params: { email, page, perPage }
        });
        // Assuming response.data is an array of messages
        if (response.data) {
            return response.data;
        } else {
            console.error("Invalid response format", response);
            return [];
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}
export default fetchMessages;
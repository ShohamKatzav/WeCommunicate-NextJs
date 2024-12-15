import AxiosWithAuth from "../utils/axiosWithAuth";

async function fetchRecentConversations() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";

    try {
        const response = await AxiosWithAuth().get(`${baseUrl}/get-conversations`);
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
export default fetchRecentConversations;
import AxiosWithAuth from "../utils/axiosWithAuth";

async function fetchMessages(page: number, participantsId: string[]) {
    if (typeof page !== 'number' || page < 1) {
        //console.error("Invalid page number");
        return [];
    }
    if (!Array.isArray(participantsId) || participantsId.some(id => typeof id !== "string")) {
        console.error("Invalid participantsId");
        return [];
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";
    const perPage = 5;

    try {
        const response = await AxiosWithAuth().get(`${baseUrl}/get-messages`, {
            params: { participantsId, page, perPage }
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
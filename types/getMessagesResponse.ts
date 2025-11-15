import Message from "./message";

export default interface getMessagesResponse {
    success: boolean,
    message: string,
    chat: Message[],
    conversation: string | null
}
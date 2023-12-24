import { useEffect, useRef, useState } from "react";
import ChatListUser from "../types/chatUser";
import { createChatUsersList, getChatUsersList } from "../actions/cookie-actions";
import ciEquals from "../utils/ciEqual";
import AxiosWithAuth from "../utils/axiosWithAuth";
import ChatUser from "../types/chatUser";
import AsName from "../utils/asName";

interface ListProps {
    chatListActiveUsers: ChatListUser[];
}

const UsersList = ({ chatListActiveUsers }: ListProps) => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH as string;
    const [chatListAllUsers, setChatListAllUsers] = useState<ChatListUser[]>([]);
    const [toggle, setToggle] = useState(true);

    const dropupRef = useRef<HTMLUListElement>(null);
    const openRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const init = async () => {
            const chatUsers = await getChatUsersList();
            if (chatUsers === undefined) {
                const response: any = await AxiosWithAuth().get(`${basePath}/get-usernames`);
                const arrayUsers: ChatUser[] = response?.data?.userNames?.map((email: string) => ({ email }));
                createChatUsersList(arrayUsers);
                setChatListAllUsers(arrayUsers);
            }
            else {
                const updatedChatUsers: ChatUser[] = JSON.parse(chatUsers.value);
                chatListActiveUsers.forEach(user => {
                    if (!updatedChatUsers.find(u => ciEquals(u.email as string, user.email as string)))
                        updatedChatUsers.push(user);
                });
                createChatUsersList(updatedChatUsers);
                setChatListAllUsers(updatedChatUsers);
            }
        }
        init();
    }, [chatListActiveUsers]);


    const dropupHandler = () => {
        if (!toggle) {
            dropupRef.current?.classList.add("hidden");
            openRef.current?.classList.add("hidden");
            closeRef.current?.classList.remove("hidden");
        } else {
            dropupRef.current?.classList.remove("hidden");
            closeRef.current?.classList.add("hidden");
            openRef.current?.classList.remove("hidden");
        }
        setToggle(!toggle);
    };

    return (
        <>
            <div>
                {toggle &&
                    <ul className="bg-white shadow sm:rounded-md md:absolute md:transform md:-translate-y-full overflow-auto h-1/2" ref={dropupRef}>
                        {chatListAllUsers?.sort((a, b) => a.email!.localeCompare(b.email!))
                            .map((user: ChatListUser, index) => (
                                <li key={index}>
                                    <div className="px-4 py-5 sm:px-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900">{AsName(user?.email as string)}</h3>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-500">
                                                Status: <span className={chatListActiveUsers.find(u => ciEquals(u.email as string, user.email as string)) ?
                                                    "text-green-600" : "text-red-600"}>
                                                    {chatListActiveUsers.find(u => ciEquals(u.email as string, user.email as string)) ? "Active" : "Inactive"}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                    </ul>
                }
                <div className="md:my-1.5"></div>
                <button className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:bg-gray-100 w-64 p-4 shadow rounded
             bg-white text-sm font-medium leading-none text-gray-800 flex items-center justify-between cursor-pointer" onClick={dropupHandler}>
                    Users
                    <div>
                        <div className="hidden" ref={closeRef}>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.00016 5.33333L0.333496 0.666664H9.66683L5.00016 5.33333Z" fill="#1F2937" />
                            </svg>
                        </div>
                        <div ref={openRef}>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.00016 0.666664L9.66683 5.33333L0.333496 5.33333L5.00016 0.666664Z" fill="#1F2937" />
                            </svg>
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
};

export default UsersList;
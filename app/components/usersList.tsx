import { useEffect, useRef, useState } from "react";
import ChatListUser from "../types/chatUser";
import { createChatUsersList, getChatUsersList } from "../actions/cookie-actions";
import ciEquals from "../utils/ciEqual";
import AxiosWithAuth from "../utils/axiosWithAuth";
import ChatUser from "../types/chatUser";
import AsName from "../utils/asName";
import useIsMedium from "../hooks/useIsMedium";

interface ListProps {
    chatListActiveUsers: ChatListUser[];
}

const UsersList = ({ chatListActiveUsers }: ListProps) => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/account";
    const [chatListAllUsers, setChatListAllUsers] = useState<ChatListUser[]>([]);
    const [toggle, setToggle] = useState(true);

    const dropRef = useRef<HTMLUListElement>(null);
    const openRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLDivElement>(null);

    const isMediumScreen = useIsMedium();


    useEffect(() => {
        const init = async () => {
            const chatUsers = await getChatUsersList();
            if (chatUsers === undefined) {
                const response: any = await AxiosWithAuth().get(`${baseUrl}/get-usernames`);
                const arrayUsers: ChatUser[] = response?.data?.map((email: string) => ({ email }));
                createChatUsersList(arrayUsers);
                setChatListAllUsers([...arrayUsers]);
            }
            else {
                const updatedChatUsers: ChatUser[] = JSON.parse(chatUsers.value);
                chatListActiveUsers.forEach(user => {
                    if (!updatedChatUsers.find(u => ciEquals(u.email as string, user.email as string)))
                        updatedChatUsers.push(user);
                });
                createChatUsersList(updatedChatUsers);
                setChatListAllUsers([...updatedChatUsers]);
            }
        }
        init();
    }, [chatListActiveUsers]);


    const dropupHandler = () => {
        if (!toggle) {
            dropRef.current?.classList.add("hidden");
            openRef.current?.classList.add("hidden");
            closeRef.current?.classList.remove("hidden");
        } else {
            dropRef.current?.classList.remove("hidden");
            closeRef.current?.classList.add("hidden");
            openRef.current?.classList.remove("hidden");
        }
        setToggle(!toggle);
    };

    return (
        <>
            <div className="flex flex-col-reverse md:flex-col">
                <div>
                    {toggle &&
                        <ul className="bg-white shadow sm:rounded-md md:absolute md:transform md:-translate-y-full md:max-h-2/5 overflow-auto" ref={dropRef}>
                            {chatListAllUsers.length > 0 &&
                                chatListAllUsers?.sort((a, b) => a.email!.localeCompare(b.email!))
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
                </div>
                <div className="md:my-1.5"></div>
                <button className="w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:bg-gray-100 p-4 shadow rounded
             bg-white text-sm font-medium leading-none text-gray-800 flex items-center justify-between cursor-pointer" onClick={dropupHandler}>
                    Users
                    <div>

                        <div ref={closeRef}>
                            {isMediumScreen &&
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.00016 5.33333L0.333496 0.666664H9.66683L5.00016 5.33333Z" fill="#1F2937" />
                                </svg>
                            }
                            {!isMediumScreen &&
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.00016 0.666664L9.66683 5.33333L0.333496 5.33333L5.00016 0.666664Z" fill="#1F2937" />
                                </svg>
                            }
                        </div>
                        <div className="hidden" ref={openRef}>
                            {isMediumScreen &&
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.00016 0.666664L9.66683 5.33333L0.333496 5.33333L5.00016 0.666664Z" fill="#1F2937" />
                                </svg>
                            }
                            {!isMediumScreen &&
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.00016 5.33333L0.333496 0.666664H9.66683L5.00016 5.33333Z" fill="#1F2937" />
                                </svg>
                            }
                        </div>
                    </div>
                </button>
            </div>
        </>
    );
};

export default UsersList;
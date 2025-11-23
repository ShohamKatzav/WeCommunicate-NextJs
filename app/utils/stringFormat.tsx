const AsName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase()
}

export const AsShortName = (email: string | undefined) => {
    return email ? email?.charAt(0).toUpperCase() + email?.slice(1).split("@")[0] : "Unknown User";
}

export const chatWithFormattedDates = (conversation: any) => {
    return conversation?.messages?.length ? conversation?.messages?.map((message: any) =>
        ({ ...message, date: new Date(message.date!).toLocaleString() })) : [];
}

export default AsName;
const AsName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase()
}

export const AsShortName = (email: string | undefined) => {
    return email ? email?.charAt(0).toUpperCase() + email?.slice(1).split("@")[0] : "Unknown User";
}

export default AsName;
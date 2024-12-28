const AsName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase()
}

export const AsShortName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase().split("@")[0] || "Unknown User";
}

export default AsName;
const AsName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase()
}

export const AsShortName = (email: string | undefined) => {
    // No placeholder word for a missing address - every caller already shows a
    // nickname first, and a fixed English "Unknown User" would leak into
    // every other language.
    return email ? email?.charAt(0).toUpperCase() + email?.slice(1).split("@")[0] : "";
}

export default AsName;
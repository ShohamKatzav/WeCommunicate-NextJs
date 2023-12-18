const AsName = (email: string) => {
    return email?.charAt(0).toUpperCase() + email?.slice(1).toLowerCase()
}

export default AsName;
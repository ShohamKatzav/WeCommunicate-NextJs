const ciEquals = (a: string | undefined, b: string | undefined) => {
    return typeof a === 'string' && typeof b === 'string'
        ? a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0
        : a === b;
}

export default ciEquals;
export default interface DecodedToken {
    _id: string;
    email: string;
    isModerator: boolean;
    signInTime: number;
    iat: number;
}
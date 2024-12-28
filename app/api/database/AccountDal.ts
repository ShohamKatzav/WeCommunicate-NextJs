import Account from "../models/Account";
import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

interface DecodedToken {
    _id: string;
    email: string;
    signInTime: number;
    iat: number;
  }

const jwtSecretKey = process.env.TOKEN_SECRET!;

export default class AccountRepository {
    

    static async getUserByToken(authHeader: string) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, jwtSecretKey) as DecodedToken;
            const { _id } = decoded;
            return await Account.findById(_id).exec();
            
        } catch (err) {
            console.error('Failed to find user by token:', err);
            throw new Error('Failed to find user by token');
        }
    }
    static async extractIDFromToken(authHeader: string) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, jwtSecretKey) as DecodedToken;
            const { _id } = decoded;
            return _id;
            
        } catch (err) {
            console.error('Failed to extract id from token:', err);
            throw new Error('Failed to extract id from token');
        }
    }
    static async getUserByID(ID: string) {
        try {
            return await Account.findById(ID).exec();
        } catch (err) {
            console.error('Failed to find user by ID:', err);
            throw new Error('Failed to find user by ID');
        }
    }
    static async getUsersByID(IDs: string[]) {
        try {
            var obj_ids = IDs.map(function(id) { return new Types.ObjectId(id); });
            return await Account.find({_id: {$in: obj_ids}}).exec();
        } catch (err) {
            console.error('Failed to find users by ID:', err);
            throw new Error('Failed to find users by ID');
        }
    }
    static async getUserByEmail(email: string) {
        try {
            return await Account.findOne({
                email: { $regex: new RegExp("^" + email + "$", "i") }
            }).exec();
        } catch (err) {
            console.error('Failed to find user by email:', err);
            throw new Error('Failed to find user by email');
        }
    }
    static async getEmailById(accountID: Types.ObjectId) {
        try {
            const user = await Account.findById(accountID).exec();
            return user?.email;
        } catch (err) {
            console.error('Failed to find user by ID:', err);
            throw new Error('Failed to find user by ID');
        }
    }
    static async addUser(email: string, hash: string) {
        try {
            const result = await Account.create({ email, password: hash });
            return result._id;
        } catch (err) {
            console.error('Failed to create user:', err);
            throw new Error('Failed to create user');
        }
    }
    static async getUsernames() {
        try {
            const users = await Account.find().exec();
            const chatUsers = users.map(user => ({ _id: user._id, email: user.email }));
            return chatUsers;
        } catch (err) {
            console.error('Could not get usernames:', err);
            throw new Error('Failed to create user');
        }
    }
}
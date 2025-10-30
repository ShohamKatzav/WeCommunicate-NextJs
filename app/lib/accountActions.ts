"use server"
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository"
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const jwtSecretKey = process.env.TOKEN_SECRET;
if (!jwtSecretKey) {
    throw new Error("TOKEN_SECRET environment variable is not set");
}

export const createUser = async (email: string, password: string) => {
    if (!email || !password)
        return JSON.parse(JSON.stringify({ message: "Email and password are required", status: 400 }));

    try {
        await connectDB();
        const user = await AccountRepository.getUserByEmail(email);
        if (user === null) {
            const hash = await bcrypt.hash(password, 10);
            const user = await AccountRepository.addUser(email, hash);
            const loginData = { _id: user._id, email, signInTime: Date.now() };
            const token = jwt.sign(loginData, jwtSecretKey!);
            return JSON.parse(JSON.stringify({ success: true, token, status: 201 }));
        }

    } catch (err) {
        console.error('Failed to create user:', err);
        return JSON.parse(JSON.stringify({ error: "Internal Server Error", status: 500 }));
    }
}

export const authenticateUser = async (email: string, password: string) => {
    if (!email || !password)
        return JSON.parse(JSON.stringify({ message: "Email and password are required", status: 400 }));

    try {
        await connectDB();
        const user = await AccountRepository.getUserByEmail(email);
        if (user !== null) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                const loginData = { _id: user._id, email, signInTime: Date.now() };
                const token = jwt.sign(loginData, jwtSecretKey!);
                return JSON.parse(JSON.stringify({ success: true, token, status: 200 }));
            }
            else
                return JSON.parse(JSON.stringify({ message: "Invalid password", status: 401 }));
        }
    } catch (err) {
        console.error('Failed to create user:', err);
        return JSON.parse(JSON.stringify({ error: "Internal Server Error", status: 500 }));
    }
}

export const getUsernames = async () => {
    try {
        await connectDB();
        const usersListResult = await AccountRepository.getUsernames();
        return JSON.parse(JSON.stringify(usersListResult));
    } catch (err) {
        console.error('Failed to get usernames:', err);
        throw err;
    }
}

export const isExist = async (email: string) => {
    try {
        await connectDB();
        const userExists = await AccountRepository.getUserByEmail(email);
        const status = userExists != null ? 200 : 401;
        const accountExists = status == 200 ? true : false;
        return JSON.parse(JSON.stringify({ accountExists, status }));
    } catch (err) {
        console.error('Failed to find user:', err);
        throw err;
    }
}
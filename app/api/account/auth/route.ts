import dbConnect from "../../database/MongoDb";
import AccountRepository from "../../database/AccountDal";
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const jwtSecretKey = process.env.TOKEN_SECRET!;

if (!jwtSecretKey) {
  throw new Error("TOKEN_SECRET environment variable is not set");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }
    await dbConnect();
    const user = await AccountRepository.getUserByEmail(email);

    if (user !== null) {
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        const loginData = { _id: user._id, email, signInTime: Date.now() };
        const token = jwt.sign(loginData, jwtSecretKey);

        return NextResponse.json({ message: "Success", token }, { status: 200 });
      } else {
        return NextResponse.json({ message: "Invalid password" }, { status: 401 });
      }
    } else {
      const hash = await bcrypt.hash(password, 10);

      try {
        const user = await AccountRepository.addUser(email, hash);
        const loginData = { _id: user._id, email, signInTime: Date.now() };
        const token = jwt.sign(loginData, jwtSecretKey);

        return NextResponse.json({ message: "Success", token }, { status: 201 });
      } catch (err) {
        console.error('Failed to create user:', err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    }
  } catch (err) {
    console.error('Failed to authenticate:', err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
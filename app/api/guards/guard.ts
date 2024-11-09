import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const jwtSecretKey = process.env.TOKEN_SECRET as jwt.Secret;

const guard = async (req: NextRequest) => {
    let authToken: string = '';

    const authHeader = req?.headers?.get('authorization');
    if (authHeader) {
        authToken = authHeader.split(' ')[1];
    } else {
        return NextResponse.json({ error: 'Authorization token missing' }, { status: 401 });
    }

    try {
        const verified = jwt.verify(authToken, jwtSecretKey);
        if (!verified) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        return null;  // Return null or undefined if no error
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
};

export default guard;
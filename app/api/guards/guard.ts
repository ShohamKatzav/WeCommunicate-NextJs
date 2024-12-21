import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const jwtSecretKey = process.env.TOKEN_SECRET as jwt.Secret;

const guard = async (req: NextRequest) => {

    const authToken = req?.headers?.get('authorization')?.split(' ')[1];
    if (!authToken) {
        return NextResponse.json({ error: 'Authorization token missing' }, { status: 401 });
    }

    try {
        const verified = jwt.verify(authToken, jwtSecretKey);
        if (!verified) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        return null;
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
};

export default guard;
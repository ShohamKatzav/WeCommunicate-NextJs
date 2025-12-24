"use server"
import { env } from '@/app/config/env';
import Brevo from "@getbrevo/brevo";
import { isExist, updatePassword, createUser } from './accountActions'
import RedisService from '@/services/RedisService'

const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, env.BREVO_API_KEY!);

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmailOTP(email: string, otp: string, mode: string = 'sign-up') {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.sender = { name: "WeCommunicate", email: env.SMTP_USER };
    sendSmtpEmail.subject = mode === 'sign-up' ? 'Verify Your Email Address' :
        'Password Reset OTP';
    sendSmtpEmail.htmlContent = mode === 'sign-up' ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome! Verify Your Email</h2>
        <p>Thank you for signing up. Please use the following OTP to verify your email address:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666;">This OTP will expire in 10 minutes.</p>
        <p style="color: #666;">If you didn't sign up for an account, please ignore this email.</p>
      </div>
    ` :
        `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You have requested to reset your password. Use the following OTP to complete the process:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666;">This OTP will expire in 10 minutes.</p>
        <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    return await apiInstance.sendTransacEmail(sendSmtpEmail);
}

export async function requestOTP(email: string, mode: string = 'sign-up') {
    try {
        if (!email) {
            return { message: 'Email is required', status: 400 };
        }
        const existsResult = await isExist(email);
        if (!existsResult.accountExists && mode === 'forgot') return { status: 200 };
        if (existsResult.accountExists && mode === 'sign-up')
            return { message: 'An account with this email is already exist', status: 400 };

        const newOTP = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        await RedisService.addOTP(email, { OTP: newOTP, expiresAt });

        await sendEmailOTP(email, newOTP, mode);

        return { message: 'OTP sent successfully', status: 200 }
    } catch (error) {
        console.error('Send OTP error:', error);
        return { message: 'Failed to send OTP', status: 500 }
    }
}

export async function verifyOTP(email: string, otp: string) {
    try {

        if (!email || !otp) {
            return { message: 'Email and OTP are required', status: 400 }
        }

        const storedData = await RedisService.getOTPByEmail(email);

        if (!storedData) {
            return { message: 'OTP not found or expired', status: 400 }
        }

        if (Date.now() > storedData.expiresAt) {
            await RedisService.deleteOTP(email);
            return { message: 'OTP has expired', status: 400 }
        }

        if (storedData.OTP !== otp) {
            return { message: 'Invalid OTP', status: 400 }
        }

        return { message: 'OTP verified successfully', status: 200 }
    } catch (error) {
        console.error('Verify OTP error:', error);
        return { message: 'Failed to verify OTP', status: 500 }
    }
}

async function validateInputBeforeAction(email: string, otp: string, newPassword: string) {
    if (!email || !otp || !newPassword) {
        return { message: 'Email, OTP, and new password are required', status: 400 }
    }

    if (newPassword.length < 8) {
        return { message: 'Password must be at least 8 characters', status: 400 }
    }

    const storedData = await RedisService.getOTPByEmail(email);

    if (!storedData) {
        return { message: 'OTP not found or expired', status: 400 }
    }

    if (Date.now() > storedData.expiresAt) {
        await RedisService.deleteOTP(email);
        return { message: 'OTP has expired', status: 400 }

    }

    if (storedData.OTP !== otp) {
        return { message: 'Invalid OTP', status: 400 }
    }
    return { status: 200 }
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
    const validationResult = await validateInputBeforeAction(email, otp, newPassword);
    if (validationResult.status !== 200)
        return validationResult;
    try {
        await updatePassword(email, newPassword);
        await RedisService.deleteOTP(email);

        return { message: 'Password reset successfully', status: 200 }
    } catch (error) {
        console.error('Reset password error:', error);
        return { message: 'Failed to reset password', status: 500 }
    }
}

export async function createAccount(email: string, otp: string, newPassword: string) {
    const validationResult = await validateInputBeforeAction(email, otp, newPassword);
    if (validationResult.status !== 200)
        return validationResult;
    try {
        await createUser(email, newPassword);
        await RedisService.deleteOTP(email);

        return { message: 'Account created successfully', status: 200 }
    } catch (error) {
        console.error('Reset password error:', error);
        return { message: 'Failed to create account', status: 500 }
    }
}
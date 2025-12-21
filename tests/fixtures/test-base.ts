import { test as baseTest } from '@playwright/test';

interface LoginData {
    username: string;
    password: string;
}

export const customTest = baseTest.extend<{
    loginData: LoginData;
}>({
    loginData: {
        username: "shoham@gmail.com",
        password: "12345678"
    }
});
import axios from 'axios';
import fetchUserData from './fetchUserData';
import User from '../types/user';

const AxiosWithAuth = () => {
    const instance = axios.create();

    instance.interceptors.request.use(
        async (config) => {
            const user = await fetchUserData() as User;
            const token = user.token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );
    return instance;
};

export default AxiosWithAuth;
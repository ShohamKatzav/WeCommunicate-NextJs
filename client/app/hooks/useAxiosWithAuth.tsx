import axios from 'axios';
import fetchUserData from '../utils/fetchUserData';
import User from '../types/user';

const useAxiosWithAuth = () => {
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

export default useAxiosWithAuth;
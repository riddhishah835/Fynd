import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server',
        details: [],
        status: null,
      });
    }

    const responseError = error.response.data?.error;

    return Promise.reject({
      code: responseError?.code ?? 'SERVER_ERROR',
      message: responseError?.message ?? 'Request failed',
      details: responseError?.details ?? [],
      status: error.response.status,
    });
  },
);

export default api;

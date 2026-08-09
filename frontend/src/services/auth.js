import api from './api';
export const loginUser=(data)=>api.post('/auth/login',data);
export const registerUser=(data)=>api.post('/auth/register',data);
export const loginWithGoogle=(data)=>api.post('/auth/google',data);
export const getProfile=()=>api.get('/users/profile');
export const updateProfile=(data)=>api.put('/users/profile',data);

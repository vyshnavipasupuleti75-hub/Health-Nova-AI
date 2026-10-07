import api from './api';
export const getNotificationConfig=()=>api.get('/notifications/config');
export const savePushSubscription=(subscription)=>api.post('/notifications/subscription',{subscription});
// Logout passes the token explicitly because it is cleared from storage before this request runs.
export const deletePushSubscription=(endpoint,token)=>api.delete('/notifications/subscription',{data:{endpoint},...(token?{headers:{Authorization:`Bearer ${token}`}}:{})});
export const sendTestNotification=(kind)=>api.post('/notifications/test',{kind});

import api from './api';
export const uploadReport=data=>api.post('/reports/upload',data);
export const getReports=()=>api.get('/reports');
export const getReport=id=>api.get(`/reports/${id}`);
export const saveReport=id=>api.patch(`/reports/${id}/save`);
export const deleteReport=id=>api.delete(`/reports/${id}`);

import api from './api';
// OCR of images and the AI explanation can take longer than the default API timeout.
export const uploadReport=data=>api.post('/reports/upload',data,{timeout:120000});
export const getReports=(config)=>api.get('/reports',config);
export const getReport=(id,config)=>api.get(`/reports/${id}`,config);
export const saveReport=id=>api.patch(`/reports/${id}/save`);
export const deleteReport=id=>api.delete(`/reports/${id}`);
export const getReportSummary=(config)=>api.get('/reports/summary',config);

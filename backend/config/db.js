import dns from 'dns';
import mongoose from 'mongoose';

const atlasSrvName = (uri) => {
  const match = uri.match(/^mongodb\+srv:\/\/[^@]+@([^/?]+)/i);
  return match ? `_mongodb._tcp.${match[1]}` : null;
};

const resolveAtlasSrv = async (uri) => {
  const srvName = atlasSrvName(uri);
  if (!srvName) return;

  try {
    await dns.promises.resolveSrv(srvName);
  } catch (error) {
    if (!['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(error.code)) throw error;
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await dns.promises.resolveSrv(srvName);
    console.log('Using public DNS fallback for MongoDB Atlas');
  }
};

export default async function connectDB() {
  try {
    await resolveAtlasSrv(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error('Check Atlas Network Access, Database Access credentials, and MONGO_URI in backend/.env.');
    process.exit(1);
  }
}

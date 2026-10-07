import dns from 'dns';
import mongoose from 'mongoose';

const atlasSrvName = (uri) => {
  const match = uri.match(/^mongodb\+srv:\/\/[^@]+@([^/?]+)/i);
  return match ? `_mongodb._tcp.${match[1]}` : null;
};

async function ensureAtlasDns(uri) {
  const srvName = atlasSrvName(uri);
  if (!srvName) return;
  try {
    await dns.promises.resolveSrv(srvName);
  } catch (error) {
    if (!['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(error.code)) throw error;
    const resolver = new dns.promises.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    const timeout = setTimeout(() => resolver.cancel(), 5000);
    try {
      await resolver.resolveSrv(srvName);
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      console.log('Using public DNS fallback for MongoDB Atlas');
    } finally {
      clearTimeout(timeout);
    }
  }
}

const RETRY_DELAY_MS = 15000;

// Summarises why server selection failed without ever printing the URI or credentials.
function describeFailure(error) {
  const causes = [...(error.reason?.servers?.values() ?? [])].map((server) => server.error).filter(Boolean);
  const text = [error.message, ...causes.map((cause) => `${cause.code ?? ''} ${cause.message ?? ''}`)].join(' ');
  if (/auth|bad auth/i.test(text)) return 'Authentication failed: check the Atlas Database Access user and password in MONGO_URI.';
  if (/TLSV1_ALERT_INTERNAL_ERROR|SSL alert number 80/i.test(text)) return 'Atlas rejected the TLS handshake: this machine\'s public IP is most likely not in Atlas Network Access.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEOUT|querySrv/i.test(text)) return 'DNS/network problem reaching the Atlas cluster hostname.';
  return 'Check Atlas Network Access, Database Access credentials, DNS connectivity, and MONGO_URI in backend/.env.';
}

export default async function connectDB() {
  try {
    await ensureAtlasDns(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error(describeFailure(error));
    console.error(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(connectDB, RETRY_DELAY_MS);
  }
}

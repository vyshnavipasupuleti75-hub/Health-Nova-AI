import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const tokenFor = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, dateOfBirth: user.dateOfBirth, age: user.age, gender: user.gender, bloodGroup: user.bloodGroup, height: user.height, weight: user.weight, emergencyContact: user.emergencyContact, address: user.address, medicalConditions: user.medicalConditions, profilePicture: user.profilePicture, settings: user.settings });

export async function register(req, res, next) {
  try {
    const { name, email, password, role = 'patient', phone, dateOfBirth, age, bloodGroup } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    if (!name?.trim() || !cleanEmail || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters' });
    if (!['patient', 'doctor'].includes(role)) return res.status(400).json({ message: 'Please select a valid account role' });
    if (role === 'patient' && (!age || !bloodGroup)) return res.status(400).json({ message: 'Age and blood group are required for patients' });
    if (await User.findOne({ email: cleanEmail })) return res.status(409).json({ message: 'An account already exists for this email' });
    const patientDetails = role === 'patient' ? { age: Number(age), bloodGroup } : {};
    const user = await User.create({ name: name.trim(), email: cleanEmail, password: await bcrypt.hash(password, 10), role, phone, dateOfBirth: dateOfBirth || undefined, ...patientDetails });
    res.status(201).json({ token: tokenFor(user._id), user: publicUser(user) });
  } catch (error) { next(error); }
}

export async function login(req, res, next) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user?.password || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid email or password' });
    if (role && user.role !== role) return res.status(403).json({ message: `This account is registered as a ${user.role}` });
    res.json({ token: tokenFor(user._id), user: publicUser(user) });
  } catch (error) { next(error); }
}

// One verifier per client ID so Google's signing certificates are cached between sign-ins.
const googleClients = new Map();
function googleVerifier(clientId) {
  if (!googleClients.has(clientId)) googleClients.set(clientId, new OAuth2Client(clientId));
  return googleClients.get(clientId);
}

const GOOGLE_LINK_PURPOSE = 'google-link';
const roleMismatch = (res, user) => res.status(403).json({ message: `This account is registered as a ${user.role}. Select "${user.role === 'doctor' ? 'Doctor' : 'Patient'}" and try again.` });

export async function googleLogin(req, res, next) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ message: 'Google sign-in is not available right now.' });
    const { credential, role = 'patient' } = req.body || {};
    if (typeof credential !== 'string' || !credential) return res.status(400).json({ message: 'Google did not return a sign-in credential. Please try again.' });
    if (!['patient', 'doctor'].includes(role)) return res.status(400).json({ message: 'Please select a valid account role' });

    // The identity is only trusted after Google's signature, audience, issuer and expiry checks pass.
    let payload;
    try {
      const ticket = await googleVerifier(clientId).verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Google sign-in expired or could not be verified. Please try again.' });
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) return res.status(401).json({ message: 'Google could not confirm the email address for this account.' });

    const email = payload.email.toLowerCase();
    // CASE 1: this Google account (stable "sub") is already linked.
    let user = await User.findOne({ googleId: payload.sub });
    if (user) {
      if (user.role !== role) return roleMismatch(res, user);
      return res.json({ token: tokenFor(user._id), user: publicUser(user) });
    }

    user = await User.findOne({ email });
    if (user) {
      if (user.googleId) return res.status(409).json({ message: 'This email is already linked to a different Google account.' });
      if (user.role !== role) return roleMismatch(res, user);
      // CASE 2: a password account owns this email. Linking needs the HealthNova password, so a Google account
      // can never take over an existing account on email alone.
      const linkToken = jwt.sign({ purpose: GOOGLE_LINK_PURPOSE, uid: String(user._id), sub: payload.sub }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.status(409).json({ code: 'GOOGLE_LINK_REQUIRED', email, linkToken, message: 'A HealthNova account already uses this email. Enter its password once to link Google sign-in.' });
    }

    // CASE 3: brand-new user from the verified Google identity.
    user = await User.create({ googleId: payload.sub, email, name: payload.name?.trim() || email.split('@')[0], role });
    return res.status(201).json({ token: tokenFor(user._id), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This Google account was just linked. Please try signing in again.' });
    next(error);
  }
}

export async function linkGoogleAccount(req, res, next) {
  try {
    const { linkToken, password } = req.body || {};
    if (typeof linkToken !== 'string' || typeof password !== 'string' || !password) return res.status(400).json({ message: 'Enter your HealthNova password to link Google sign-in.' });
    let claim;
    try {
      claim = jwt.verify(linkToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'The linking request expired. Continue with Google again.' });
    }
    if (claim?.purpose !== GOOGLE_LINK_PURPOSE || !claim.uid || !claim.sub) return res.status(401).json({ message: 'The linking request expired. Continue with Google again.' });

    const user = await User.findById(claim.uid);
    if (!user?.password || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Incorrect password' });
    if (user.googleId && user.googleId !== claim.sub) return res.status(409).json({ message: 'This account is already linked to a different Google account.' });
    if (await User.exists({ googleId: claim.sub, _id: { $ne: user._id } })) return res.status(409).json({ message: 'This Google account is already linked to another HealthNova account.' });
    user.googleId = claim.sub;
    await user.save();
    return res.json({ token: tokenFor(user._id), user: publicUser(user) });
  } catch (error) { next(error); }
}

import crypto from "crypto";

const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

export const generateOtp = (email, req) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(email, {
    otpHash: hashOtp(otp),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    ua: req.headers["user-agent"],
    ip: req.ip
  });

  return otp;
};

export const verifyOtp = (email, otp, req) => {
  const record = otpStore.get(email);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return false;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return false;
  }

  // Bind OTP to same device
  if (record.ua !== req.headers["user-agent"]) {
    return false;
  }

  record.attempts++;

  if (hashOtp(otp) !== record.otpHash) {
    return false;
  }

  // SUCCESS → delete OTP
  otpStore.delete(email);
  return true;
};

export const deleteOtp = (email) => {
  otpStore.delete(email);
};

// Cleanup expired OTPs (single timer, safe)
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);

export default {
  generateOtp,
  verifyOtp,
  deleteOtp
};

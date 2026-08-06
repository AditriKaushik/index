function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  jwtAccessSecret: () => required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: () => required("JWT_REFRESH_SECRET"),
  webauthnRpId: () => process.env.WEBAUTHN_RP_ID ?? "localhost",
  webauthnRpName: () => process.env.WEBAUTHN_RP_NAME ?? "Social Platform",
  webauthnOrigin: () => process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000",
  otpProvider: () => process.env.OTP_PROVIDER ?? "console",
};

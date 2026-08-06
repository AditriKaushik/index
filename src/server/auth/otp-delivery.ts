/**
 * OTP delivery is pluggable so a real SMS/email provider (Twilio, SNS, SES,
 * Postmark, ...) can be dropped in per deployment/region without touching
 * the auth flow. The default "console" provider just logs the code, which
 * is only appropriate for local development.
 */
export interface OtpDeliveryProvider {
  sendSms(toPhone: string, code: string): Promise<void>;
  sendEmail(toEmail: string, code: string): Promise<void>;
}

class ConsoleOtpProvider implements OtpDeliveryProvider {
  async sendSms(toPhone: string, code: string) {
    console.log(`[dev-otp] SMS to ${toPhone}: your code is ${code}`);
  }
  async sendEmail(toEmail: string, code: string) {
    console.log(`[dev-otp] Email to ${toEmail}: your code is ${code}`);
  }
}

let provider: OtpDeliveryProvider = new ConsoleOtpProvider();

export function getOtpProvider(): OtpDeliveryProvider {
  return provider;
}

/** Swap in a real provider at app startup, e.g. from an instrumentation hook. */
export function setOtpProvider(next: OtpDeliveryProvider): void {
  provider = next;
}

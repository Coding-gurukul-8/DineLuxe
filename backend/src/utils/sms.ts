// Use require to avoid TS module resolution error if axios types aren't installed.
declare var require: any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

export interface SMSTemplate {
  template_id: string;
  variables: string[];
}

export interface SMSSendResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '').trim();
}

export async function sendSMS(phone: string, message: string, templateId?: string): Promise<SMSSendResult> {
  const sanitizedPhone = phone?.trim();
  if (!sanitizedPhone) {
    console.warn('[SMS] Empty phone. SMS skipped.');
    return { success: false, error: 'Empty phone' };
  }

  try {
    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const msg91DefaultTemplateId = process.env.MSG91_DEFAULT_TEMPLATE_ID;

    if (msg91AuthKey) {
      const template_id = templateId || msg91DefaultTemplateId;
      if (!template_id) {
        console.warn('[SMS] MSG91 template_id missing. SMS skipped.');
        return { success: false, error: 'MSG91 template_id missing' };
      }

      const url = 'https://control.msg91.com/api/v5/flow/';

      const payload = {
        template_id,
        short_url: false,
        mobiles: normalizePhone(sanitizedPhone),
        VAR1: message,
      };

      const resp = await axios.post(url, payload, {
        headers: {
          authkey: msg91AuthKey,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      });

      // MSG91 response shape can vary; best-effort pull.
      const message_id = resp.data?.message_id ?? resp.data?.data?.message_id;
      return { success: true, message_id };
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;

    if (twilioSid && twilioToken && twilioFrom) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

      const form = new URLSearchParams();
      form.set('From', twilioFrom);
      form.set('To', sanitizedPhone);
      form.set('Body', message);

      const resp = await axios.post(url, form, {
        auth: {
          username: twilioSid,
          password: twilioToken,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15_000,
      });

      const message_id = resp.data?.sid;
      return { success: true, message_id };
    }

    console.warn('[SMS] No SMS provider configured. SMS skipped.');
    return { success: false, error: 'No SMS provider configured' };
  } catch (err) {
    console.error('[SMS] sendSMS failed:', err);
    return { success: false, error: (err as Error)?.message ?? 'SMS send failed' };
  }
}

export async function sendOTPSMS(phone: string, otp: string): Promise<SMSSendResult> {
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  const message = `Your DineLuxe verification OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`;
  return sendSMS(phone, message, templateId);
}

export async function sendBookingConfirmationSMS(
  phone: string,
  restaurantName: string,
  date: string,
  time: string,
  tableLabel: string
): Promise<SMSSendResult> {
  const templateId = process.env.MSG91_BOOKING_TEMPLATE_ID;
  const message = `Booking confirmed at ${restaurantName}! Table ${tableLabel} on ${date} at ${time}. DineLuxe.`;
  return sendSMS(phone, message, templateId);
}

export async function sendStaffCredentialsSMS(
  phone: string,
  restaurantName: string,
  tempPassword: string,
  loginUrl: string
): Promise<SMSSendResult> {
  const templateId = process.env.MSG91_STAFF_TEMPLATE_ID;
  const message = `Your ${restaurantName} staff account is ready. Temp password: ${tempPassword}. Login: ${loginUrl}. Change password on first login.`;
  return sendSMS(phone, message, templateId);
}

export async function sendDeliveryUpdateSMS(
  phone: string,
  status: string,
  restaurantName: string
): Promise<SMSSendResult> {
  const templateId = process.env.MSG91_DELIVERY_TEMPLATE_ID;
  const message = `Your order from ${restaurantName} is ${status}. Track on DineLuxe.`;
  return sendSMS(phone, message, templateId);
}


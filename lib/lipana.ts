/**
 * Lipana API Client for M-Pesa STK Push payments
 * Documentation: https://lipana.dev/docs
 */

const LIPANA_API_BASE_URL = 'https://api.lipana.dev/v1';

export interface LipanaStkPushRequest {
  phone: string; // Format: +254712345678 or 254712345678
  amount: number; // Amount in KES, minimum 10
  accountReference?: string; // Optional reference
  transactionDesc?: string; // Optional description
}

export interface LipanaStkPushResponse {
  success: boolean;
  message: string;
  data: {
    transactionId: string;
    status: 'pending' | 'success' | 'failed';
    checkoutRequestID: string;
    message: string;
  };
}

export interface LipanaWebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.pending';
  data: {
    transactionId: string;
    amount: number;
    currency: string;
    status: 'success' | 'failed' | 'pending';
    phone: string;
    checkoutRequestID: string;
    timestamp: string;
  };
}

export class LipanaClient {
  private apiKey: string;
  private environment: 'sandbox' | 'production';

  constructor(apiKey: string, environment: 'sandbox' | 'production' = 'sandbox') {
    this.apiKey = apiKey;
    this.environment = environment;
  }

  /**
   * Initiate STK Push payment
   * Sends M-Pesa payment prompt to customer's phone
   */
  async initiateStkPush(request: LipanaStkPushRequest): Promise<LipanaStkPushResponse> {
    try {
      // Validate amount
      if (request.amount < 10) {
        throw new Error('Minimum transaction amount is KES 10');
      }

      // Format phone number (ensure it starts with +254 or 254)
      let phone = request.phone.trim();
      if (phone.startsWith('0')) {
        phone = '+254' + phone.substring(1);
      } else if (phone.startsWith('254')) {
        phone = '+' + phone;
      } else if (!phone.startsWith('+254')) {
        throw new Error('Invalid phone number format. Use +254XXXXXXXXX or 254XXXXXXXXX');
      }

      const response = await fetch(`${LIPANA_API_BASE_URL}/transactions/push-stk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          phone,
          amount: Math.round(request.amount), // Ensure integer
          accountReference: request.accountReference,
          transactionDesc: request.transactionDesc,
        }),
      });

      const rawData = await response.json();

      console.log('Lipana STK Push Raw Response:', { status: response.status, data: rawData });

      if (!response.ok) {
        const errorMsg = rawData.message || rawData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Handle both response formats:
      // Format 1: Direct response with data.transactionId
      // Format 2: Nested response with data.data.transactionId (actual Lipana format)
      const apiData = rawData.data?.data || rawData.data || rawData;
      
      const structuredResponse: LipanaStkPushResponse = {
        success: rawData.success || apiData.status === 'pending' || false,
        message: rawData.message || apiData.message || 'Payment initiated',
        data: {
          transactionId: apiData.transactionId || apiData.transaction_id || '',
          status: apiData.status || 'pending',
          checkoutRequestID: apiData.checkoutRequestID || apiData.checkout_request_id || '',
          message: apiData.message || 'STK push sent'
        }
      };

      console.log('Lipana STK Push Parsed Response:', structuredResponse);

      if (!structuredResponse.data.transactionId) {
        throw new Error('No transactionId in Lipana response');
      }

      return structuredResponse;
    } catch (error) {
      console.error('Lipana STK Push Error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * Ensures webhook request is authentic from Lipana
   */
  static async verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): Promise<boolean> {
    try {
      // Create HMAC-SHA256 hash
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );

      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Constant-time comparison to prevent timing attacks
      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(body: string): LipanaWebhookPayload {
    return JSON.parse(body);
  }
}

// Export singleton instance for convenience
// Note: In Expo, environment variables are replaced at build time
const apiKey = process.env.EXPO_PUBLIC_LIPANA_SECRET_KEY || '';
const environment = process.env.EXPO_PUBLIC_LIPANA_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

export const lipana = new LipanaClient(apiKey, environment);

// Debug: Log if API key is missing
if (!apiKey) {
  console.warn('⚠️ EXPO_PUBLIC_LIPANA_SECRET_KEY not set in .env file');
} else {
  console.log('✓ Lipana initialized in', environment, 'mode');
}

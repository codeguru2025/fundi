declare module "paynow" {
  export class Paynow {
    resultUrl: string;
    returnUrl: string;
    constructor(integrationId: string, integrationKey: string);
    createPayment(reference: string, email: string): Payment;
    send(payment: Payment): Promise<InitResponse>;
    sendMobile(payment: Payment, phone: string, method: string): Promise<InitResponse>;
    pollTransaction(pollUrl: string): Promise<StatusResponse>;
  }

  export interface Payment {
    add(title: string, amount: number): void;
  }

  export interface InitResponse {
    success: boolean;
    redirectUrl?: string;
    pollUrl: string;
    instructions?: string;
    error?: string;
  }

  export interface StatusResponse {
    paid(): boolean;
    status(): string;
    reference: string;
  }
}

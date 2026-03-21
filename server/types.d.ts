declare module 'paynow' {
  export class Paynow {
    constructor(integrationId: string, integrationKey: string);
    resultUrl: string;
    returnUrl: string;
    createPayment(reference: string, email: string): any;
    send(payment: any): Promise<any>;
    sendMobile(payment: any, phone: string, method: string): Promise<any>;
    pollTransaction(pollUrl: string): Promise<any>;
  }
}

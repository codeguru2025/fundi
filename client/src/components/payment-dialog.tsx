import { useState, useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CreditCard, Smartphone, CheckCircle } from "lucide-react";

function getBuyerToken(): string {
  const key = "fundi_buyer_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = `buyer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  book: {
    id: string;
    title: string;
    price: number;
  };
  onPaymentSuccess: () => void;
  userId?: string;
}

type PaymentMethod = "web" | "ecocash" | "onemoney";
type PaymentStep = "method" | "processing" | "instructions" | "success" | "error";

export function PaymentDialog({ open, onClose, book, onPaymentSuccess, userId }: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("method");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("web");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pollUrl, setPollUrl] = useState("");
  const [isPolling, setIsPolling] = useState(false);

  const resetState = () => {
    setStep("method");
    setPaymentMethod("web");
    setPhone("");
    setEmail("");
    setError("");
    setInstructions("");
    setPollUrl("");
    setIsPolling(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const initiatePayment = async () => {
    setStep("processing");
    setError("");

    try {
      const buyerToken = userId || getBuyerToken();
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          bookId: book.id,
          buyerToken,
          email,
          phone: paymentMethod !== "web" ? phone : undefined,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment initiation failed");
      }

      if (data.success) {
        setPollUrl(data.pollUrl);
        
        if (paymentMethod === "web" && data.redirectUrl) {
          window.open(data.redirectUrl, "_blank");
          setInstructions("Complete your payment in the new window, then click 'Check Payment Status' below.");
          setStep("instructions");
        } else if (data.instructions) {
          setInstructions(data.instructions);
          setStep("instructions");
        }
      } else {
        throw new Error(data.error || "Payment failed");
      }
    } catch (err: any) {
      setError(err.message || "Payment failed. Please try again.");
      setStep("error");
    }
  };

  const checkPaymentStatus = async () => {
    if (!pollUrl) return;
    
    setIsPolling(true);
    
    try {
      const buyerToken = userId || getBuyerToken();
      const response = await fetch("/api/payments/check-status", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ pollUrl, bookId: book.id, buyerToken, email }),
      });

      const data = await response.json();

      if (data.paid) {
        setStep("success");
        setTimeout(() => {
          onPaymentSuccess();
          handleClose();
        }, 2000);
      } else {
        setInstructions(`Payment status: ${data.status}. Please complete your payment and try again.`);
      }
    } catch (err) {
      setError("Failed to check payment status");
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase "{book.title}"</DialogTitle>
          <DialogDescription>
            Total: ${book.price.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {step === "method" && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Select Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="web" id="web" />
                  <Label htmlFor="web" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Pay Online</p>
                      <p className="text-xs text-muted-foreground">Card, Ecocash, or OneMoney via Paynow</p>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="ecocash" id="ecocash" />
                  <Label htmlFor="ecocash" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Smartphone className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Ecocash Express</p>
                      <p className="text-xs text-muted-foreground">Pay directly from your phone</p>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="onemoney" id="onemoney" />
                  <Label htmlFor="onemoney" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Smartphone className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium">OneMoney Express</p>
                      <p className="text-xs text-muted-foreground">Pay directly from your phone</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {(paymentMethod === "ecocash" || paymentMethod === "onemoney") && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="0771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-phone"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional, for receipt)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={initiatePayment}
              disabled={(paymentMethod !== "web" && !phone)}
              data-testid="button-proceed-payment"
            >
              Proceed to Pay ${book.price.toFixed(2)}
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium">Processing Payment...</p>
            <p className="text-sm text-muted-foreground">Please wait while we connect to Paynow</p>
          </div>
        )}

        {step === "instructions" && (
          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">Payment initiated. Click below to check if your payment was successful.</p>
            </div>
            
            <Button 
              className="w-full" 
              onClick={checkPaymentStatus}
              disabled={isPolling}
              data-testid="button-check-status"
            >
              {isPolling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check Payment Status"
              )}
            </Button>
            
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <p className="text-xl font-bold text-green-700">Payment Successful!</p>
            <p className="text-muted-foreground mt-2">You now have full access to this book.</p>
          </div>
        )}

        {step === "error" && (
          <div className="py-4 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
            
            <Button className="w-full" onClick={() => setStep("method")}>
              Try Again
            </Button>
            
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

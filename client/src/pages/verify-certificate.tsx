import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { verifyCertificate } from "@/lib/api";
import { Award, CheckCircle, XCircle, Loader2, Shield, GraduationCap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function VerifyCertificate() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        const data = await verifyCertificate(token || "");
        setResult(data);
      } catch {
        setError(true);
      }
      setLoading(false);
    }
    if (token) verify();
  }, [token]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !result?.valid) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" data-testid="text-invalid-cert">Invalid Certificate</h1>
            <p className="text-muted-foreground mb-6">
              This certificate could not be verified. It may not exist or the token is incorrect.
            </p>
            <Button asChild data-testid="button-go-home">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const cert = result.certificate;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <CheckCircle className="w-4 h-4" />
              Verified Authentic
            </div>
            <h1 className="text-2xl font-bold text-green-700" data-testid="text-verified">Certificate Verified</h1>
            <p className="text-muted-foreground text-sm mt-1">This certificate is authentic and was issued by Fundi Academy.</p>
          </div>

          <div className="relative bg-gradient-to-br from-[#faf5eb] via-[#f5eedf] to-[#faf5eb] border-2 border-amber-400 rounded-xl overflow-hidden shadow-xl" data-testid="certificate-card">
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#1c2852]" />
            <div className="absolute top-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#1c2852]" />
            <div className="absolute bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
            <div className="absolute inset-4 border border-amber-300/60 rounded-lg pointer-events-none" />
            <div className="absolute inset-5 border border-dashed border-amber-200/40 rounded-lg pointer-events-none" />
            <div className="relative px-6 sm:px-10 py-10 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-[#1c2852] flex items-center justify-center shadow-md border-2 border-amber-300">
                  <GraduationCap className="w-7 h-7 text-amber-400" />
                </div>
              </div>
              <p className="text-xs font-bold tracking-[0.35em] uppercase text-[#1c2852] mb-0.5">Fundi Academy</p>
              <p className="text-[10px] italic tracking-wider text-amber-600 mb-1">Excellence in Education</p>
              <div className="w-48 h-px mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent mb-4" />
              <p className="text-base font-serif font-bold tracking-[0.2em] uppercase text-[#1c2852] mb-5">
                {cert.courseLevel ? cert.courseLevel.toUpperCase() : "CERTIFICATE OF COMPLETION"}
              </p>
              <p className="text-sm text-gray-500 mb-2">This is to certify that</p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1c2852] mb-2 pb-2 border-b-2 border-amber-400 inline-block max-w-full break-words" data-testid="text-cert-name">{cert.userName}</h3>
              <p className="text-sm text-gray-500 mt-4 mb-2">has successfully completed the course</p>
              <h4 className="text-lg sm:text-xl font-serif font-semibold text-[#1c2852] mb-1 max-w-full break-words" data-testid="text-cert-course">{cert.courseTitle}</h4>
              <p className="text-sm text-gray-500 mb-8">Instructor: {cert.instructorName}</p>
              <div className="flex items-end justify-between gap-4 pt-4 border-t border-amber-300/60">
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-4">
                    <div className="text-left">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Date Issued</p>
                      <p className="text-xs text-gray-600 font-medium">{new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Certificate ID</p>
                      <p className="text-[10px] font-mono font-bold text-gray-600 break-all">{cert.verificationToken}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <img src="/signature-clean.png" alt="Signature" className="h-10 mx-auto mb-1 opacity-80" />
                    <p className="text-xs font-serif font-bold text-[#1c2852]">Augustus Siziba</p>
                    <p className="text-[9px] text-gray-400">Founder & Director of Education</p>
                  </div>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <QRCodeSVG
                    value={`${window.location.origin}/verify/${cert.verificationToken}`}
                    size={80}
                    level="M"
                    bgColor="transparent"
                    fgColor="#1c2852"
                  />
                  <p className="text-[8px] text-gray-400 mt-1">Scan to Verify</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <Button asChild variant="outline" data-testid="button-go-home">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

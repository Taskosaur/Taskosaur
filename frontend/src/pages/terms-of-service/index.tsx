import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/header/ModeToggle";
import { HiArrowLeft } from "react-icons/hi2";

export default function TermsOfServicePage() {
  const router = useRouter();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="hover:bg-muted"
            >
              <HiArrowLeft className="h-5 w-5" />
            </Button>
            <ModeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
            <p className="text-muted-foreground">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using Taskosaur ("the Service"), you accept and agree to be bound
                by the terms and provision of this agreement. If you do not agree to abide by the
                above, please do not use this service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Taskosaur provides a comprehensive project management and collaboration platform
                that includes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Task and project management tools</li>
                <li>Team collaboration features</li>
                <li>Workspace organization capabilities</li>
                <li>Sprint planning and tracking</li>
                <li>Kanban and Gantt chart views</li>
                <li>Real-time notifications and updates</li>
                <li>Analytics and reporting features</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                3. User Account and Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account and
                password. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Immediately notify us of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4. User Conduct</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Upload or transmit viruses or malicious code</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon intellectual property rights</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Attempt to gain unauthorized access to the Service or related systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                5. Content Ownership and Rights
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of all content you submit to the Service. By submitting
                content, you grant us a worldwide, non-exclusive, royalty-free license to use,
                reproduce, and display such content solely for the purpose of providing and
                improving the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                6. Privacy and Data Protection
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your use of our Service is also governed by our Privacy Policy. Please review our{" "}
                <Link href="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                , which also governs the Site and informs users of our data collection practices.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                7. Service Availability and Modifications
              </h2>
              <p className="text-muted-foreground leading-relaxed">We reserve the right to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Modify or discontinue the Service at any time</li>
                <li>Change features, functionality, or pricing</li>
                <li>
                  Impose limits on certain features or restrict access to parts of the Service
                </li>
                <li>Terminate or suspend accounts that violate these terms</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, Taskosaur shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or any loss of
                profits or revenues, whether incurred directly or indirectly, or any loss of data,
                use, goodwill, or other intangible losses.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">9. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless Taskosaur and its affiliates, officers,
                agents, and employees from any claim or demand, including reasonable attorneys'
                fees, made by any third party due to or arising out of your use of the Service, your
                violation of these Terms, or your violation of any rights of another.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">10. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the
                jurisdiction in which Taskosaur operates, without regard to its conflict of law
                provisions.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to update or change our Terms of Service at any time. We will
                notify you of any changes by posting the new Terms of Service on this page and
                updating the "Last updated" date.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">12. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="pl-6 space-y-1 text-muted-foreground">
                <p>Email: legal@taskosaur.com</p>
              </div>
            </section>
          </div>

          <div className="pt-8 border-t">
            <p className="text-center text-sm text-muted-foreground">
              By using Taskosaur, you acknowledge that you have read and understood these Terms of
              Service and agree to be bound by them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

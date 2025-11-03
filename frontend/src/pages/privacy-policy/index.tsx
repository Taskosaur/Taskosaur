import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/header/ModeToggle";
import { HiArrowLeft } from "react-icons/hi2";

export default function PrivacyPolicyPage() {
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
            <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
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
              <p className="text-muted-foreground leading-relaxed">
                At Taskosaur, we take your privacy seriously. This Privacy Policy explains how we
                collect, use, disclose, and safeguard your information when you use our project
                management platform.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1. Information We Collect</h2>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">1.1 Personal Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We collect information you provide directly to us, such as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Name and email address</li>
                  <li>Account credentials</li>
                  <li>Profile information (avatar, job title, department)</li>
                  <li>Organization and workspace details</li>
                  <li>Communication preferences</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">1.2 Usage Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We automatically collect certain information about your device and how you
                  interact with our Service:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Browser type and version</li>
                  <li>Operating system</li>
                  <li>IP address</li>
                  <li>Pages visited and features used</li>
                  <li>Time spent on pages</li>
                  <li>Click patterns and interaction data</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">1.3 Project and Task Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you use Taskosaur, we store:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Project names, descriptions, and settings</li>
                  <li>Task details, assignments, and status updates</li>
                  <li>Comments and attachments</li>
                  <li>Sprint and workflow configurations</li>
                  <li>Team member roles and permissions</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                2. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide, operate, and maintain our Service</li>
                <li>Improve, personalize, and expand our Service</li>
                <li>Understand and analyze how you use our Service</li>
                <li>Develop new products, services, features, and functionality</li>
                <li>Communicate with you for customer service and support</li>
                <li>Send you notifications and updates (with your consent)</li>
                <li>Process your transactions and manage billing</li>
                <li>Find and prevent fraud and abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                3. Information Sharing and Disclosure
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell, trade, or rent your personal information. We may share your
                information in the following situations:
              </p>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">3.1 With Your Consent</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may share your information with your explicit consent or at your direction.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">
                  3.2 Within Your Organization
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Information within workspaces is shared with other members according to the
                  permissions and roles set by workspace administrators.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">3.3 Service Providers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may share information with third-party vendors who perform services on our
                  behalf, such as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Cloud hosting and data storage providers</li>
                  <li>Analytics services</li>
                  <li>Customer support tools</li>
                  <li>Payment processors</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">3.4 Legal Requirements</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may disclose your information if required by law or in response to valid legal
                  requests.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational security measures to protect
                your personal information, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and audits</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                However, no method of electronic transmission or storage is 100% secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">5. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your personal information for as long as necessary to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide our services to you</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce agreements</li>
                <li>Maintain business records for analysis and/or audit purposes</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                When your account is deleted, we will delete or anonymize your personal information
                within 90 days, except where retention is required by law.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">6. Your Rights and Choices</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have certain rights regarding your personal information:
              </p>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">6.1 Access and Portability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can access and export your data through your account settings.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">6.2 Correction</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can update your personal information in your account profile.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">6.3 Deletion</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request deletion of your account and personal information by contacting
                  support.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">
                  6.4 Communication Preferences
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can manage your email and notification preferences in your account settings.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                7. Cookies and Tracking Technologies
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Keep you logged in</li>
                <li>Remember your preferences</li>
                <li>Understand how you use our Service</li>
                <li>Deliver relevant content</li>
                <li>Improve our Service</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                You can control cookies through your browser settings, but disabling cookies may
                limit your ability to use certain features.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                8. International Data Transfers
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your
                own. We ensure appropriate safeguards are in place to protect your information in
                accordance with this Privacy Policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">9. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not directed to individuals under 16 years of age. We do not
                knowingly collect personal information from children under 16. If we become aware
                that we have collected personal information from a child under 16, we will take
                steps to delete such information.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                10. Changes to This Privacy Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any
                changes by posting the new Privacy Policy on this page and updating the "Last
                updated" date. For material changes, we will provide additional notice via email or
                through the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please
                contact us at:
              </p>
              <div className="pl-6 space-y-1 text-muted-foreground">
                <p>Email: privacy@taskosaur.com</p>
                <p>Data Protection Officer: dpo@taskosaur.com</p>
              </div>
            </section>
          </div>

          <div className="pt-8 border-t">
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                By using Taskosaur, you acknowledge that you have read and understood this Privacy
                Policy.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                View our{" "}
                <Link href="/terms-of-service" className="text-primary hover:underline">
                  Terms of Service
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

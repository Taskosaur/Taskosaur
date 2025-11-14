import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import Image from "next/image";
import { Shield } from "lucide-react";

export function SetupContent() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="setup-hero-container">
      {/* Main Content */}
      <div className="setup-hero-content">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="setup-brand-header"
        >
          <div className="">
            <div className="flex items-center">
              <Image
                src="/taskosaur-logo.svg"
                alt="Taskosaur Logo"
                width={50}
                height={50}
                className={`size-6 lg:size-10 ${
                  resolvedTheme === "light" ? "filter invert brightness-200" : ""
                }`}
              />
              <h1 className="setup-brand-title">Taskosaur</h1>
            </div>
          </div>

          <h2 className="setup-hero-heading">
            Begin your
            <br />
            <span className="setup-hero-heading-gradient">productivity journey</span>
          </h2>

          <p className="setup-hero-description">
            Set up your super admin account to unlock the full power of Taskosaur's
            AI-powered project management platform for your entire organization.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

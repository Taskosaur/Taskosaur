import { motion } from 'framer-motion';
import { Sparkles, Award } from 'lucide-react';

export function RegisterContent() {

  return (
    <div className="signup-hero-container">
      
      {/* Main Content */}
      <div className="signup-hero-content relative z-10">
        {/* Brand Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="signup-brand-header"
        >
          <div className="signup-brand-logo-row">
            <div className="signup-brand-logo-icon">
              <Sparkles className="signup-brand-logo-sparkles" />
            </div>
            <div>
              <h1 className="signup-brand-title">Taskosaur</h1>
              <div className="signup-brand-subtitle-row">
                <Award className="signup-brand-award-icon" />
                <p className="signup-brand-subtitle">Join the Evolution</p>
              </div>
            </div>
          </div>
          
          <h2 className="signup-hero-heading">
            Start your journey to
            <br />
            <span className="signup-hero-heading-gradient">
              effortless productivity
            </span>
          </h2>
          
          <p className="signup-hero-description">
            Create your free account today and discover why thousands of teams 
            choose Taskosaur to streamline their workflow and achieve more.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

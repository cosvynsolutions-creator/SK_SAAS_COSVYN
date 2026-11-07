
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

const Terms = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Zap size={24} className="text-primary-600" fill="currentColor" /> ScaleKitchen
          </Link>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-primary-600 flex items-center gap-1">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
        <p className="text-slate-500 mb-8">Last Updated: December 2026</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
            <p>Welcome to ScaleKitchen. By accessing our website and using our SaaS platform for meal subscription businesses, you agree to be bound by these Terms and Conditions.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Use of Service</h2>
            <p>You agree to use our platform only for lawful purposes related to managing your business operations. You must not misuse the service to distribute spam, malware, or illegal content.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Accounts & Subscription</h2>
            <p>To access features, you must register an account. You are responsible for maintaining the confidentiality of your login credentials. Subscriptions are billed in advance on a recurring basis (Monthly, 6-Monthly, or Yearly).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Intellectual Property</h2>
            <p>The ScaleKitchen platform, including its code, design, and branding, is the intellectual property of Cosvyn Solutions. You are granted a limited, non-exclusive license to use the software while your subscription is active.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Limitation of Liability</h2>
            <p>ScaleKitchen shall not be liable for any indirect, incidental, or consequential damages resulting from your use or inability to use the service, including loss of business data or revenue.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;

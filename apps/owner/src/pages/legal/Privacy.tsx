
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

const Privacy = () => {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Effective Date: December 2026</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us when you create an account, such as your name, business name, email address, and phone number. We also store data related to your business operations (customers, deliveries, expenses) that you input into the system.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <p>We use your information to provide, maintain, and improve our services, process transactions, and communicate with you about updates or support.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Data Storage & Security</h2>
            <p>Your data is securely stored on Google Cloud Firestore (Firebase). We implement industry-standard security measures to protect your data from unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Third-Party Services</h2>
            <p>We use third-party payment gateways (like Razorpay/Stripe) to process payments. We do not store your full credit card details on our servers.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at cosvynsolutions@gmail.com.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;

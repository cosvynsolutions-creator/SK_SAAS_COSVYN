import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

export const Shipping: React.FC = () => {
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
        <h1 className="text-3xl font-bold mb-2">Shipping & Delivery Policy</h1>
        <p className="text-slate-500 mb-8">Applicable for SaaS Products</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Digital Delivery</h2>
            <p>ScaleKitchen is a Software-as-a-Service (SaaS) platform. We do not sell physical goods, and therefore, no physical shipping is involved.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Service Activation</h2>
            <p>Upon successful payment for a subscription plan, your account is automatically activated, and you will receive immediate access to the premium features associated with your plan.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Confirmation</h2>
            <p>You will receive a confirmation email with your invoice and account details instantly after the purchase is completed.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Issues with Access</h2>
            <p>If you do not receive access immediately after payment, please contact our support team at cosvynsolutions@gmail.com with your transaction ID.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Shipping;

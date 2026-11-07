import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

export const Refunds: React.FC = () => {
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
        <h1 className="text-3xl font-bold mb-2">Cancellation and Refund Policy</h1>
        <p className="text-slate-500 mb-8">Fair and Transparent.</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Cancellation Policy</h2>
            <p>You may cancel your subscription at any time via your account settings or by contacting support. Your cancellation will take effect at the end of the current paid term. We do not provide pro-rated refunds for cancellations made mid-term.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Refund Policy</h2>
            <p>We offer a 7-day money-back guarantee for new customers on their first purchase.</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
               <li>If you are unsatisfied with the service, you must request a refund within 7 days of the initial transaction.</li>
               <li>Refund requests made after 7 days will not be processed.</li>
               <li>Refunds are processed to the original method of payment within 5-7 business days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Automatic Renewals</h2>
            <p>Unless you notify us before the end of the applicable subscription period that you want to cancel, your subscription will automatically renew, and you authorize us to collect the then-applicable annual or monthly subscription fee.</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Refunds;

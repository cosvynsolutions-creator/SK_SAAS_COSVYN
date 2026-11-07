
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Mail, MapPin, Phone } from 'lucide-react';

const Contact = () => {
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
        <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
        <p className="text-lg text-slate-600 mb-12 leading-relaxed">
          Have questions about our platform or need support? We're here to help. Reach out to us via email or visit our office.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Email Us</h3>
                <p className="text-slate-500 mb-1">For support and queries</p>
                <a href="mailto:cosvynsolutions@gmail.com" className="text-primary-600 font-medium hover:underline">
                  cosvynsolutions@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Office</h3>
                <p className="text-slate-500 mb-1">Cosvyn Solutions</p>
                <p className="text-slate-600">
                  Sai Nagar 2nd Line<br/>
                  Narasaraopet, Andhra Pradesh<br/>
                  India
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Phone</h3>
                <p className="text-slate-500 mb-1">Mon-Fri, 9am to 6pm</p>
                <p className="text-slate-600">7702667567</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
             <h3 className="font-bold text-xl mb-4">Send a Message</h3>
             <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Name</label>
                   <input className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500 bg-white" placeholder="Your Name" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Email</label>
                   <input type="email" className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500 bg-white" placeholder="your@email.com" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-1">Message</label>
                   <textarea rows={4} className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-primary-500 bg-white" placeholder="How can we help?" />
                </div>
                <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors">
                   Send Message
                </button>
             </form>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Contact;

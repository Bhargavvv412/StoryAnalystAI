import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User, MessageSquare, Send, CheckCircle, Github, Twitter, Linkedin } from "lucide-react";
import { submitContact } from "../services/api";
import useStore from "../state/store";
import Button from "../components/Button";
import Card from "../components/Card";

export default function Contact() {
  const [form, setForm]       = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { addToast }          = useStore();

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await submitContact(form);
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      addToast("Message sent! We'll be in touch soon.", "success");
    } catch (err) {
      addToast(err.message || "Failed to send message.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-display font-bold text-5xl text-white mb-4">
            Get in <span className="gradient-text">touch</span>
          </h1>
          <p className="text-white/50 text-lg">Have questions? We'd love to hear from you.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-2xl p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-emerald-400" />
                  </div>
                  <h2 className="font-display font-bold text-2xl text-white mb-2">Message Sent!</h2>
                  <p className="text-white/50">We'll get back to you within 24 hours.</p>
                  <button onClick={() => setSuccess(false)} className="btn-secondary mt-6">Send Another</button>
                </motion.div>
              ) : (
                <motion.div key="form">
                  <Card>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="contact-name">Name</label>
                          <div className="relative">
                            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                            <input id="contact-name" name="name" type="text" required value={form.name} onChange={handleChange} className="input-field pl-9" placeholder="John Doe" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="contact-email">Email</label>
                          <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                            <input id="contact-email" name="email" type="email" required value={form.email} onChange={handleChange} className="input-field pl-9" placeholder="you@example.com" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="contact-subject">Subject</label>
                        <input id="contact-subject" name="subject" type="text" value={form.subject} onChange={handleChange} className="input-field" placeholder="How can we help?" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5" htmlFor="contact-message">Message</label>
                        <div className="relative">
                          <MessageSquare size={15} className="absolute left-3 top-3.5 text-white/30" />
                          <textarea id="contact-message" name="message" required value={form.message} onChange={handleChange} rows={6} className="textarea-field pl-9" placeholder="Describe your question or feedback..." />
                        </div>
                      </div>

                      <Button type="submit" loading={loading} className="w-full" icon={Send}>
                        Send Message
                      </Button>
                    </form>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Info */}
          <div className="lg:col-span-2 space-y-4">
            {[
              { title: "Email", value: "hello@storyanalyst.ai", icon: Mail },
              { title: "Response Time", value: "Within 24 hours", icon: CheckCircle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} hover={false}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-purple/20 flex items-center justify-center">
                      <Icon size={18} className="text-brand-purple" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40">{item.title}</p>
                      <p className="text-sm font-medium text-white">{item.value}</p>
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card hover={false}>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Follow us</h3>
              <div className="flex gap-3">
                {[{ icon: Twitter, label: "Twitter", href: "#" }, { icon: Github, label: "GitHub", href: "#" }, { icon: Linkedin, label: "LinkedIn", href: "#" }].map((s) => {
                  const Icon = s.icon;
                  return (
                    <a key={s.label} href={s.href} aria-label={s.label} className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                      <Icon size={16} />
                    </a>
                  );
                })}
              </div>
            </Card>

            <Card hover={false}>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">FAQ</h3>
              <div className="space-y-3 text-sm">
                {[
                  { q: "Is there a free plan?", a: "Yes! Free forever with 10 generations/month." },
                  { q: "Can I cancel anytime?", a: "Yes, no commitments. Cancel with one click." },
                ].map((faq) => (
                  <div key={faq.q}>
                    <p className="font-medium text-white/70">{faq.q}</p>
                    <p className="text-white/40 text-xs mt-0.5">{faq.a}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

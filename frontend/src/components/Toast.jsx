import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import useStore from "../state/store";

const icons = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
  warning: AlertTriangle,
};

const colors = {
  success: "border-emerald-500/40 text-emerald-400",
  error:   "border-red-500/40 text-red-400",
  info:    "border-blue-500/40 text-blue-300",
  warning: "border-orange-500/40 text-orange-400",
};

function ToastItem({ id, message, type = "info" }) {
  const removeToast = useStore((s) => s.removeToast);
  const Icon = icons[type] || Info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`glass-strong rounded-xl px-4 py-3 flex items-start gap-3 min-w-72 max-w-sm border ${colors[type] || colors.info}`}
    >
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <p className="text-sm text-white/90 flex-1">{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function ToastContainer() {
  const toasts = useStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

import { clsx } from "clsx";
import { motion } from "framer-motion";

const variants = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  ghost:     "btn-ghost",
  danger:    "px-6 py-3 rounded-xl font-semibold text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all duration-200",
};

const sizes = {
  sm:  "px-4 py-2 text-xs",
  md:  "",
  lg:  "px-8 py-4 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  icon: Icon,
  onClick,
  type = "button",
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        variants[variant] || variants.primary,
        sizes[size],
        "flex items-center justify-center gap-2 select-none",
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>Processing…</span>
        </>
      ) : (
        <>
          {Icon && <Icon size={16} />}
          {children}
        </>
      )}
    </motion.button>
  );
}

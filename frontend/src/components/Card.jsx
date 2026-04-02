import { motion } from "framer-motion";
import { clsx } from "clsx";

export default function Card({ children, className = "", hover = true, gradient = false, onClick, ...props }) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.01 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={clsx(
        "glass rounded-2xl p-6",
        hover && "cursor-default",
        gradient && "bg-card-gradient",
        onClick && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface CanvasModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg"; // adaptive sizing
}

export default function CanvasModal({
  title,
  children,
  onClose,
  size = "sm",
}: CanvasModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger animation after short delay
    const timer = setTimeout(() => setVisible(true), 10);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  // Adaptive width classes
  const sizeClasses = {
    sm: "w-[420px] max-w-[92vw]",
    md: "w-[520px] max-w-[95vw]",
    lg: "w-[640px] max-w-[95vw]",
  }[size];

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[999] transition-colors duration-200 ${
        visible ? "bg-black/30" : "bg-black/0"
      }`}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white rounded-lg shadow-xl ${sizeClasses} p-6 transform transition-all duration-200 ease-out ${
          visible
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-1"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-canvas-grayDark">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}

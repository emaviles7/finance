"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { formatCurrency } from "@/lib/utils/currency";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prevValue.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate(v) {
        node.textContent = formatCurrency(v);
      },
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <p ref={ref} className={className}>
      {formatCurrency(0)}
    </p>
  );
}

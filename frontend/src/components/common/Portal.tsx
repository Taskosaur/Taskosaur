import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

//Portal to display confirmation modal at the top of the screen
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}

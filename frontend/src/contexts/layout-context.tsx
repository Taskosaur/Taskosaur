import React, { createContext, useContext, useState, ReactNode } from "react";

interface LayoutContextType {
  show404: boolean;
  setShow404: (show: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within LayoutProvider");
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider = ({ children }: LayoutProviderProps) => {
  const [show404, setShow404] = useState(false);

  return (
    <LayoutContext.Provider value={{ show404, setShow404 }}>
      {children}
    </LayoutContext.Provider>
  );
};

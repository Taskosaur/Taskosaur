import React, { ReactNode, useEffect, useState } from "react";
import OrganizationProvider from "@/contexts/organization-context";
import WorkspaceProvider from "@/contexts/workspace-context";
import ProjectProvider from "@/contexts/project-context";
import SprintProvider from "@/contexts/sprint-context";
import TaskProvider from "@/contexts/task-context";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Breadcrumb from "@/components/layout/Breadcrumb";

interface CommonProvidersProps {
  children: ReactNode;
}

export default function PublicProviders({ children }: CommonProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <OrganizationProvider>
        <WorkspaceProvider>
          <ProjectProvider>
            <SprintProvider>
              <TaskProvider>
                <div
                  className="min-h-screen bg-[var(--background)]"
                  style={{ scrollbarGutter: "stable" }}
                >
                  <div className="flex h-screen">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden ">
                      <Header />
                      <div
                        className="flex-1 overflow-y-scroll scrollbar-none "
                        style={{ scrollbarGutter: "stable" }}
                      >
                        {mounted && (
                          <div
                            id="modal-root"
                            className="fixed z-[1000] inset-0 pointer-events-none"
                          />
                        )}
                        <div className="max-w-[1400px] mx-auto">{children}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </TaskProvider>
            </SprintProvider>
          </ProjectProvider>
        </WorkspaceProvider>
      </OrganizationProvider>
    </>
  );
}

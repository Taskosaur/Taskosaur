import React, { ReactNode, useEffect, useState } from "react";
import OrganizationProvider from "@/contexts/organization-context";
import WorkspaceProvider from "@/contexts/workspace-context";
import ProjectProvider from "@/contexts/project-context";
import SprintProvider from "@/contexts/sprint-context";
import TaskProvider from "@/contexts/task-context";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Breadcrumb from "@/components/layout/Breadcrumb";
import InboxProvider from "@/contexts/inbox-context";
import { LayoutProvider, useLayout } from "@/contexts/layout-context";

interface CommonProvidersProps {
  children: ReactNode;
}

function AppProvidersContent({ children }: CommonProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const { show404 } = useLayout();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <OrganizationProvider>
        <WorkspaceProvider>
          <ProjectProvider>
            <InboxProvider>
              <SprintProvider>
                <TaskProvider>
                  {/* If showing 404, render children without layout */}
                  {show404 ? (
                    <>{children}</>
                  ) : (
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
                            <div className="max-w-[1400px] mx-auto">
                              <Breadcrumb />
                              {children}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TaskProvider>
              </SprintProvider>
            </InboxProvider>
          </ProjectProvider>
        </WorkspaceProvider>
      </OrganizationProvider>
    </>
  );
}

export default function AppProviders({ children }: CommonProvidersProps) {
  return (
    <LayoutProvider>
      <AppProvidersContent>{children}</AppProvidersContent>
    </LayoutProvider>
  );
}

import ActionButton from "@/components/common/ActionButton";
import { HiCalendar } from "react-icons/hi2";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";
import { useState } from "react";
interface DashboardHeaderProps {
  currentUser: any;
  greeting: string;
  currentDate: string;
  onTodayAgendaClick: () => void;
}

export function DashboardHeader({
  currentUser,
  greeting,
  currentDate,
  onTodayAgendaClick,
}: DashboardHeaderProps) {
  const [isNewTaskModalOpen, setNewTaskModalOpen] = useState(false);

  return (
    <div className="dashboard-header">
      <div className="dashboard-user-section">
        <div className="dashboard-user-avatar">
          {currentUser?.firstName?.charAt(0) || "U"}
          {currentUser?.lastName?.charAt(0) || ""}
        </div>
        <div>
          <h1 className="dashboard-greeting">
            {greeting}, {currentUser?.firstName || "User"}!
          </h1>
          <p className="dashboard-date-info">{currentDate} • Ready to tackle your goals?</p>
        </div>
      </div>

      <div className="dashboard-header-actions">
        <ActionButton
          onClick={onTodayAgendaClick}
          secondary
          rightIcon={<HiCalendar className="dashboard-icon-sm" />}
        >
          Today's Agenda
        </ActionButton>

        {/* New Task Button and Modal */}
        {(() => {
          return (
            <>
              <ActionButton showPlusIcon primary onClick={() => setNewTaskModalOpen(true)}>
                New Task
              </ActionButton>
              <NewTaskModal
                isOpen={isNewTaskModalOpen}
                onClose={() => setNewTaskModalOpen(false)}
              />
            </>
          );
        })()}
      </div>
    </div>
  );
}

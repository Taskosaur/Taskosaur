import { Organization } from "@/types";
import { Badge, Card, CardContent } from "../ui";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { HiCalendar, HiCheck, HiClock } from "react-icons/hi";
import { HiBuildingOffice2, HiRocketLaunch } from "react-icons/hi2";

const OrganizationSelectionCard = ({
  organization,
  isSelected,
  onSelect,
}: {
  organization: Organization;
  isSelected: boolean;
  onSelect: (org: Organization) => void;
}) => {
  const getInitials = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || "?";
  };

  return (
    <Card
      className={`organizations-selection-card ${
        isSelected
          ? "organizations-selection-card-selected"
          : "organizations-selection-card-unselected"
      }`}
      onClick={() => onSelect(organization)}
    >
      <CardContent className="organizations-selection-card-content">
        <div className="organizations-selection-card-header">
          <Avatar className="organizations-selection-card-avatar">
            <AvatarFallback className="organizations-selection-card-avatar-fallback">
              {getInitials(organization.name)}
            </AvatarFallback>
          </Avatar>
          <div className="organizations-selection-card-info">
            <div className="organizations-selection-card-title-row">
              <h3 className="organizations-selection-card-title">{organization.name}</h3>
              {isSelected && (
                <div className="organizations-selection-card-check">
                  <HiCheck size={14} className="text-[var(--primary-foreground)]" />
                </div>
              )}
            </div>

            {organization.description && (
              <p className="organizations-selection-card-description">{organization.description}</p>
            )}

            <div className="organizations-selection-card-stats">
              {organization._count && (
                <>
                  <div className="organizations-selection-card-stat">
                    <HiBuildingOffice2 size={12} />
                    <span>{organization._count.members} members</span>
                  </div>
                  <div className="organizations-selection-card-stat">
                    <HiRocketLaunch size={12} />
                    <span>{organization._count.workspaces} workspaces</span>
                  </div>
                </>
              )}
              {organization.createdAt && (
                <div className="organizations-selection-card-stat">
                  <HiCalendar size={12} />
                  <span>{new Date(organization.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {organization.settings?.features && (
              <div className="organizations-selection-card-features">
                {organization.settings.features.timeTracking && (
                  <Badge variant="secondary" className="organizations-selection-card-feature-badge">
                    <HiClock size={10} className="mr-1" />
                    Time Tracking
                  </Badge>
                )}
                {organization.settings.features.automation && (
                  <Badge variant="secondary" className="organizations-selection-card-feature-badge">
                    <HiRocketLaunch size={10} className="mr-1" />
                    Automation
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
export default OrganizationSelectionCard;

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { HiExclamationTriangle } from "react-icons/hi2";

type DangerZoneProps = {
  title: string;
  actionTitle: string;
  description: string;
  type?: "workspace" | "project" | "account";
  severity?: "high" | "critical";
  disabled?: boolean;
  loading?: boolean;
  onAction?: () => void;
  bulletPoints?: string[];
};

export function DangerZone({
  title,
  actionTitle,
  description,
  severity = "high",
  disabled = false,
  loading = false,
  onAction,
  bulletPoints = [],
}: DangerZoneProps) {
  const isCritical = severity === "critical";

  return (
    <Card
      className={`rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden 
      ${
        isCritical
          ? "bg-red-50/50 border-red-900/30"
          : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
      }`}
    >
      <CardHeader
        className={
          isCritical
            ? "bg-gradient-to-r from-red-500/5 via-red-500/10 to-red-600/10 border-b border-red-900/30 p-5"
            : ""
        }
      >
        {isCritical ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                  <HiExclamationTriangle className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg font-semibold text-red-700">Danger Zone</CardTitle>
              </div>
              <CardDescription className="text-sm text-red-600/80 mt-2 pl-12 leading-relaxed">
                Irreversible and destructive actions. Please proceed with extreme caution.
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="text-xs bg-red-300/10 hover:bg-red-400/20 text-red-700 rounded-md border border-red-800/50 px-2 py-1"
            >
              Critical
            </Badge>
          </div>
        ) : (
          <CardTitle className="text-lg font-semibold text-red-700">Danger Zone</CardTitle>
        )}
      </CardHeader>

      <CardContent className={isCritical ? "p-6" : ""}>
        <div
          className={`flex ${isCritical ? "flex-col lg:flex-row items-start lg:items-center" : "items-center"} justify-between gap-6 
          ${isCritical ? "p-5 rounded-md bg-red-950/10 border border-red-900/30 shadow-inner" : ""}`}
        >
          <div className="flex-1">
            {isCritical ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-md bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <HiExclamationTriangle className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-sm font-semibold text-red-600">{title}</h3>
              </div>
            ) : (
              <h3 className="font-medium text-red-600">{title}</h3>
            )}

            <p
              className={`${isCritical ? "text-sm text-red-700/80 leading-relaxed mb-3" : "text-sm text-red-600"} 
              ${isCritical ? "pl-10" : ""}`}
            >
              {description}
            </p>

            {isCritical && bulletPoints.length > 0 && (
              <div className="space-y-1.5 pl-10">
                {bulletPoints.map((point, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-red-700/80">
                    <span className="mt-0.5">•</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${isCritical ? "w-full lg:w-auto mt-4 lg:mt-0" : ""}`}>
            <Button
              variant="destructive"
              size={isCritical ? "sm" : "default"}
              onClick={onAction}
              disabled={disabled || loading}
              className={`${
                isCritical
                  ? "rounded-md bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow hover:shadow-md border-none px-4 py-2 h-auto w-full lg:w-auto"
                  : "opacity-50 cursor-not-allowed"
              } 
                ${disabled && !isCritical ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <div className="flex items-center gap-2 py-0.5">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-0.5">
                  {isCritical && <HiExclamationTriangle className="w-4 h-4" />}
                  <span>Delete {actionTitle}</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

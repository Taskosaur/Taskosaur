import { useRouter } from "next/router";
import SuperAdminGuard from "@/components/auth/SuperAdminGuard";
import { cn } from "@/lib/utils";
import {
  HiShieldCheck,
  HiUsers,
  HiBuildingOffice2,
  HiCog6Tooth,
  HiChartBar,
} from "react-icons/hi2";
import { useTranslation } from "react-i18next";

const getAdminNavItems = (t: any) => [
  { id: "dashboard", label: t("navigation.overview"), href: "/admin", icon: HiChartBar },
  { id: "users", label: t("navigation.users"), href: "/admin/users", icon: HiUsers },
  { id: "organizations", label: t("navigation.organizations"), href: "/admin/organizations", icon: HiBuildingOffice2 },
  { id: "config", label: t("navigation.configuration"), href: "/admin/config", icon: HiCog6Tooth },
];

function getActiveTab(pathname: string): string {
  if (pathname === "/admin") return "dashboard";
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/organizations")) return "organizations";
  if (pathname.startsWith("/admin/config")) return "config";
  return "dashboard";
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const router = useRouter();
  if (items.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[var(--border)]">/</span>}
          {item.href ? (
            <button
              onClick={() => router.push(item.href!)}
              className="hover:text-[var(--foreground)] transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-[var(--foreground)] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

function AdminLayoutContent({ children, breadcrumbs }: AdminLayoutProps) {
  const router = useRouter();
  const { t } = useTranslation("admin");
  const activeTab = getActiveTab(router.pathname);
  const adminNavItems = getAdminNavItems(t);

  return (
    <div className="dashboard-container">
      {/* Admin Header */}
      <div className="flex items-center gap-2 mb-1">
        <HiShieldCheck className="w-5 h-5 text-[var(--primary)]" />
        <h1 className="text-md font-bold text-[var(--foreground)]">{t("administration")}</h1>
      </div>

      {/* Sub Navigation */}
      <div className="border-b border-[var(--border)] mb-6">
        <nav className="flex space-x-6" aria-label="Admin navigation">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex items-center gap-2 px-1 py-2 text-sm font-medium relative transition-colors cursor-pointer",
                  isActive
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon size={16} />
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--primary)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      {/* Page Content */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children, breadcrumbs }: AdminLayoutProps) {
  return (
    <SuperAdminGuard>
      <AdminLayoutContent breadcrumbs={breadcrumbs}>{children}</AdminLayoutContent>
    </SuperAdminGuard>
  );
}

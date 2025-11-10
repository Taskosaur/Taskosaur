import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";

// Helper: Convert slug-like text into Title Case
const formatSegment = (segment) => {
  return segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

// Helper: Detect if a segment is a UUID
const isUUID = (segment) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (!pathname) return;

    const segments = pathname.split("/").filter((seg) => seg.length > 0);

    const items = segments.map((seg, idx) => {
      const href = "/" + segments.slice(0, idx + 1).join("/");
      let displayName = formatSegment(seg);

      // Enhanced UUID handling
      if (isUUID(seg)) {
        const previousSegment = segments[idx - 1];
        if (previousSegment) {
          // Convert previous segment to singular form for details
          const baseEntity = formatSegment(previousSegment);
          // Remove plural 's' if exists
          const singularEntity = baseEntity.endsWith("s") ? baseEntity.slice(0, -1) : baseEntity;
          displayName = `${singularEntity} Details`;
        } else {
          displayName = "Details";
        }
      }

      return {
        name: displayName,
        href,
        current: idx === segments.length - 1,
        isUUID: isUUID(seg),
      };
    });

    setBreadcrumbs(items);
  }, [pathname]);

  if (
    !pathname ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/workspaces") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/activities") ||
    pathname === "/tasks/" ||
    pathname === "/settings/" ||
    breadcrumbs.length === 0
  ) {
    return null;
  }

  return (
    <div className="breadcrumb-container">
      <div className="">
        <ShadcnBreadcrumb>
          <BreadcrumbList className="breadcrumb-nav">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="breadcrumb-link">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="breadcrumb-separator">
              <ChevronRight className="breadcrumb-separator-icon" />
            </BreadcrumbSeparator>
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={item.href}>
                <BreadcrumbItem className="breadcrumb-item">
                  {item.current ? (
                    <BreadcrumbPage className="breadcrumb-current">
                      <span className="breadcrumb-current-text">{item.name}</span>
                      {item.isUUID && <div className="breadcrumb-uuid-indicator" />}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href} className="breadcrumb-link">
                        <span className="breadcrumb-link-text">{item.name}</span>
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="breadcrumb-separator">
                    <ChevronRight className="breadcrumb-separator-icon" />
                  </BreadcrumbSeparator>
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </ShadcnBreadcrumb>
      </div>
    </div>
  );
}

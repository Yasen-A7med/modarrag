import {
  BookOpen,
  Building2,
  Calendar,
  ClipboardCheck,
  Home,
  LayoutDashboard,
  PlusSquare,
  Shield,
  Users,
} from "lucide-react";

export type SchoolShellNavIcon =
  | "calendar"
  | "check"
  | "layout"
  | "plus"
  | "users"
  | "building"
  | "book"
  | "shield"
  | "home";

export interface SchoolShellNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: SchoolShellNavIcon;
  readonly active?: boolean;
  readonly badge?: string | number;
}

export function renderSchoolNavIcon(
  icon: SchoolShellNavIcon,
  className = "h-5 w-5"
) {
  switch (icon) {
    case "calendar":
      return <Calendar className={className} strokeWidth={2} />;
    case "check":
      return <ClipboardCheck className={className} strokeWidth={2} />;
    case "layout":
      return <LayoutDashboard className={className} strokeWidth={2} />;
    case "plus":
      return <PlusSquare className={className} strokeWidth={2} />;
    case "users":
      return <Users className={className} strokeWidth={2} />;
    case "building":
      return <Building2 className={className} strokeWidth={2} />;
    case "book":
      return <BookOpen className={className} strokeWidth={2} />;
    case "shield":
      return <Shield className={className} strokeWidth={2} />;
    case "home":
    default:
      return <Home className={className} strokeWidth={2} />;
  }
}

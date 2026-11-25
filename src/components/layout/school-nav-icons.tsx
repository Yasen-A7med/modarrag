import {
  BookOpen,
  Building2,
  Calendar,
  Home,
  LayoutDashboard,
  PlusSquare,
  QrCode,
  Shield,
  Ticket,
  Users,
} from "lucide-react";

export type SchoolShellNavIcon =
  | "calendar"
  | "ticket"
  | "layout"
  | "plus"
  | "users"
  | "building"
  | "book"
  | "scan"
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
  className = "h-4 w-4"
) {
  switch (icon) {
    case "calendar":
      return <Calendar className={className} strokeWidth={1.85} />;
    case "ticket":
      return <Ticket className={className} strokeWidth={1.85} />;
    case "layout":
      return <LayoutDashboard className={className} strokeWidth={1.85} />;
    case "plus":
      return <PlusSquare className={className} strokeWidth={1.85} />;
    case "users":
      return <Users className={className} strokeWidth={1.85} />;
    case "building":
      return <Building2 className={className} strokeWidth={1.85} />;
    case "book":
      return <BookOpen className={className} strokeWidth={1.85} />;
    case "scan":
      return <QrCode className={className} strokeWidth={1.85} />;
    case "shield":
      return <Shield className={className} strokeWidth={1.85} />;
    case "home":
    default:
      return <Home className={className} strokeWidth={1.85} />;
  }
}

import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Gauge,
  GraduationCap,
  HelpCircle,
  Inbox,
  Presentation,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageCircleQuestion,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Package,
  PlugZap,
  Quote,
  Radio,
  Receipt,
  Repeat,
  Route,
  Scale,
  Settings,
  ShieldCheck,
  Star,
  TicketPercent,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ShellArea = "learn" | "teach" | "admin";

export type BadgeKey = "unreadMessages" | "unreadNotifications" | "pendingReviews" | "openTickets" | "pendingCourses";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: BadgeKey;
  /** Match only the exact path (for section roots like /admin). */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: Record<ShellArea, NavGroup[]> = {
  learn: [
    {
      items: [
        { title: "Dashboard", href: "/learn", icon: LayoutDashboard, exact: true },
        { title: "My courses", href: "/learn/courses", icon: BookOpen },
        { title: "Live classes", href: "/learn/live", icon: Radio },
        { title: "Assignments", href: "/learn/assignments", icon: ClipboardList },
        { title: "Certificates", href: "/learn/certificates", icon: Award },
      ],
    },
    {
      label: "Community",
      items: [
        { title: "Messages", href: "/learn/messages", icon: MessageSquare, badge: "unreadMessages" },
        { title: "Support", href: "/learn/support", icon: LifeBuoy },
      ],
    },
    {
      label: "Account",
      items: [
        { title: "Billing", href: "/learn/billing", icon: CreditCard },
        { title: "Notifications", href: "/learn/notifications", icon: Bell, badge: "unreadNotifications" },
        { title: "Settings", href: "/learn/settings", icon: Settings },
      ],
    },
    {
      items: [{ title: "Browse courses", href: "/courses", icon: Compass }],
    },
  ],
  teach: [
    {
      items: [
        { title: "Dashboard", href: "/teach", icon: LayoutDashboard, exact: true },
        { title: "Courses", href: "/teach/courses", icon: BookOpen },
        { title: "Students", href: "/teach/students", icon: Users },
        { title: "Reviews", href: "/teach/reviews", icon: ClipboardCheck, badge: "pendingReviews" },
        { title: "Live classes", href: "/teach/live", icon: Radio },
        { title: "Questions", href: "/teach/questions", icon: MessageCircleQuestion },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages", href: "/teach/messages", icon: MessageSquare, badge: "unreadMessages" },
        { title: "Support", href: "/teach/support", icon: LifeBuoy, badge: "openTickets" },
      ],
    },
    {
      label: "Insights",
      items: [{ title: "Analytics", href: "/teach/analytics", icon: BarChart3 }],
    },
    {
      label: "Account",
      items: [
        { title: "Notifications", href: "/teach/notifications", icon: Bell, badge: "unreadNotifications" },
        { title: "Settings", href: "/teach/settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      items: [{ title: "Overview", href: "/admin", icon: Gauge, exact: true }],
    },
    {
      label: "Learning",
      items: [
        { title: "Courses", href: "/admin/courses", icon: BookOpen, badge: "pendingCourses" },
        { title: "Categories", href: "/admin/categories", icon: FolderTree },
        { title: "Learning programs", href: "/admin/programs", icon: Route },
        { title: "Live classes", href: "/admin/live", icon: Radio },
      ],
    },
    {
      label: "People",
      items: [
        { title: "Instructors", href: "/admin/instructors", icon: UserCheck },
        { title: "Students", href: "/admin/students", icon: GraduationCap },
        { title: "Enrollments", href: "/admin/enrollments", icon: BookOpenCheck },
      ],
    },
    {
      label: "Commerce",
      items: [
        { title: "Pricing & plans", href: "/admin/pricing", icon: Package },
        { title: "Bundles & memberships", href: "/admin/bundles", icon: Layers },
        { title: "Coupons", href: "/admin/coupons", icon: TicketPercent },
        { title: "Payments", href: "/admin/payments", icon: Wallet },
        { title: "Invoices", href: "/admin/invoices", icon: Receipt },
        { title: "Subscriptions", href: "/admin/subscriptions", icon: Repeat },
      ],
    },
    {
      label: "Community",
      items: [
        { title: "Discussions", href: "/admin/discussions", icon: MessagesSquare },
        { title: "Course reviews", href: "/admin/reviews", icon: Star },
        { title: "Messages", href: "/admin/messages", icon: MessageSquare, badge: "unreadMessages" },
        { title: "Support tickets", href: "/admin/support", icon: LifeBuoy, badge: "openTickets" },
      ],
    },
    {
      label: "Website",
      items: [
        { title: "Website content", href: "/admin/content", icon: FileText },
        { title: "Blog", href: "/admin/blog", icon: Newspaper },
        { title: "Testimonials", href: "/admin/testimonials", icon: Quote },
        { title: "Case studies", href: "/admin/case-studies", icon: Trophy },
        { title: "FAQs", href: "/admin/faqs", icon: HelpCircle },
        { title: "Legal pages", href: "/admin/legal", icon: Scale },
        { title: "Leads & newsletter", href: "/admin/leads", icon: Inbox },
      ],
    },
    {
      label: "Communications",
      items: [
        { title: "Email templates", href: "/admin/emails", icon: Mail },
        { title: "Announcements", href: "/admin/notifications", icon: Megaphone },
      ],
    },
    {
      label: "Insights",
      items: [
        { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
        { title: "Reports & exports", href: "/admin/reports", icon: FileSpreadsheet },
      ],
    },
    {
      label: "System",
      items: [
        { title: "Integrations", href: "/admin/integrations", icon: PlugZap },
        { title: "Settings", href: "/admin/settings", icon: Building2 },
        { title: "Security & audit", href: "/admin/audit", icon: ShieldCheck },
      ],
    },
  ],
};

export const AREA_LABEL: Record<ShellArea, string> = {
  learn: "Student",
  teach: "Instructor",
  admin: "Admin",
};

export const AREA_HOME: Record<ShellArea, string> = {
  learn: "/learn",
  teach: "/teach",
  admin: "/admin",
};

export const AREA_ICON: Record<ShellArea, LucideIcon> = {
  learn: GraduationCap,
  teach: Presentation,
  admin: ShieldCheck,
};

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react";
import AppLogo from "./AppLogo";
import RoleToggle from "./RoleToggle";
import DemoPersonaPicker from "./DemoPersonaPicker";
import UserAvatar from "./UserAvatar";
import GlobalSearchModal from "./GlobalSearchModal";
import NotificationsPanel from "./NotificationsPanel";
import { studentViewEventName, useStudentView } from "../utils/studentView";
import { ensureDemoRoster, getActiveStudentId, setActiveStudentId } from "../utils/demoPersona";
import { loadCourses } from "../utils/coursesStore";
import { loadUser } from "../utils/userStore";
import { getEffectiveUnreadInboxCount } from "../utils/inbox";
import { getEffectiveUnreadNotificationCount, NOTIFICATIONS_CHANGED_EVENT } from "../utils/notifications";

const NAV_COLLAPSED_KEY = "canvasClone:globalNavCollapsed";

const navItems = [
  { label: "Dashboard", icon: Home, path: "/" },
  { label: "Courses", icon: Layers, path: "/courses" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "Inbox", icon: Inbox, path: "/inbox" },
];

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Tooltip for collapsed side-nav icons. Portaled + fixed so it sits flush to the
 * icon and is not offset/clipped by the sticky nav or course sidebar.
 */
function NavTip({ label }: { label: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const parent = anchorRef.current?.parentElement;
    const tip = tipRef.current;
    if (!parent || !tip) return;
    const rect = parent.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 8;
    let top = rect.top + rect.height / 2 - tipRect.height / 2;
    let left = rect.right + gap;
    const margin = 6;
    top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, label, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const parent = anchorRef.current?.parentElement;
    if (!parent) return;
    const onEnter = () => setOpen(true);
    const onLeave = () => setOpen(false);
    parent.addEventListener("mouseenter", onEnter);
    parent.addEventListener("mouseleave", onLeave);
    parent.addEventListener("focusin", onEnter);
    parent.addEventListener("focusout", onLeave);
    return () => {
      parent.removeEventListener("mouseenter", onEnter);
      parent.removeEventListener("mouseleave", onLeave);
      parent.removeEventListener("focusin", onEnter);
      parent.removeEventListener("focusout", onLeave);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} className="sr-only" aria-hidden="true" />
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={
              coords
                ? { position: "fixed", top: coords.top, left: coords.left, zIndex: 10000 }
                : { position: "fixed", top: 0, left: 0, zIndex: 10000, visibility: "hidden" }
            }
            className="pointer-events-none whitespace-nowrap rounded bg-canvas-grayDark px-2 py-1 text-xs font-medium text-white shadow-md ring-1 ring-white/10"
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}

export default function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { studentView } = useStudentView();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(getEffectiveUnreadInboxCount);
  const [notifUnreadCount, setNotifUnreadCount] = useState(getEffectiveUnreadNotificationCount);
  const [user, setUser] = useState(loadUser);
  const searchRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get("q") ?? "";
  const onCoursesCatalog = location.pathname === "/courses";

  useEffect(() => {
    for (const course of loadCourses(true)) {
      ensureDemoRoster(course.id);
    }
    if (!getActiveStudentId()) setActiveStudentId("1");
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    const refresh = () => {
      setUnreadCount(getEffectiveUnreadInboxCount());
      setNotifUnreadCount(getEffectiveUnreadNotificationCount());
      setUser(loadUser());
    };
    window.addEventListener("canvasClone:inboxChanged", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener(studentViewEventName, refresh);
    window.addEventListener("canvasClone:userChanged", refresh);
    window.addEventListener("canvasClone:settingsChanged", refresh);
    return () => {
      window.removeEventListener("canvasClone:inboxChanged", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(studentViewEventName, refresh);
      window.removeEventListener("canvasClone:userChanged", refresh);
      window.removeEventListener("canvasClone:settingsChanged", refresh);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onOpenSearch = () => setGlobalSearchOpen(true);
    window.addEventListener("canvasClone:openGlobalSearch", onOpenSearch);
    return () => window.removeEventListener("canvasClone:openGlobalSearch", onOpenSearch);
  }, []);

  const handleSearchChange = (value: string) => {
    if (value.trim().length >= 2 && !onCoursesCatalog) {
      setGlobalSearchOpen(true);
      return;
    }
    if (onCoursesCatalog) {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set("q", value);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    } else if (value.trim()) {
      navigate(`/courses?q=${encodeURIComponent(value.trim())}`);
    }
  };

  const navLinkClass = (isActive: boolean) =>
    [
      "group relative flex items-center rounded-lg text-[13px] font-medium transition-all",
      collapsed ? "mx-auto w-10 justify-center px-0 py-2.5" : "mx-2 gap-3 px-3 py-2.5",
      isActive
        ? "bg-white/10 text-white"
        : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
    ].join(" ");

  const navContent = (
    <>
      <div
        className={`relative border-b border-white/10 ${collapsed ? "px-2 py-4" : "px-5 py-5"}`}
      >
        <Link
          to="/"
          title="CourseArc"
          className={`flex items-center hover:opacity-90 ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <AppLogo size={collapsed ? 32 : 36} variant="mark" />
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold leading-tight text-white">CourseArc</p>
              <p className="text-[11px] text-gray-400">Learning platform</p>
            </div>
          )}
        </Link>
      </div>

      <div
        className={`relative border-b border-white/10 ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}
        data-tour="nav-search"
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label="Search courses"
            className="group relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <Search className="h-4 w-4" />
            <NavTip label="Search courses" />
          </button>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search courses…"
              value={onCoursesCatalog ? query : ""}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (!onCoursesCatalog) setGlobalSearchOpen(true);
              }}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-canvas-blue/50 focus:outline-none focus:ring-2 focus:ring-canvas-blue/20"
            />
          </div>
        )}
      </div>

      <div
        className={`relative flex items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2 py-3" : "gap-3 px-5 py-4"
        }`}
      >
        <Link
          to="/settings"
          aria-label={`${user.name} — Settings`}
          className={`group relative flex min-w-0 items-center rounded-lg transition hover:bg-white/5 ${
            collapsed ? "mx-auto h-10 w-10 justify-center" : "flex-1 gap-3"
          }`}
        >
          <UserAvatar
            name={user.name}
            initials={user.avatarInitials}
            color={user.avatarColor}
            imageUrl={user.avatarImage}
            doodleId={user.avatarDoodle}
            size="md"
            ring
          />
          {collapsed && <NavTip label={`${user.name} — Settings`} />}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-400">
                {studentView ? "Student" : "Instructor"}
              </p>
            </div>
          )}
        </Link>
      </div>

      <div className="relative flex-1 overflow-hidden py-4">
        {!collapsed && (
          <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const { label, icon: Icon, path } = item;
          const isActive =
            label === "Dashboard"
              ? location.pathname === "/"
              : label === "Courses"
                ? location.pathname.startsWith("/courses")
                : location.pathname === path;

          return (
            <Link
              key={label}
              to={path}
              aria-label={label}
              className={navLinkClass(isActive)}
            >
              <div
                className={`absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full transition-all ${
                  isActive
                    ? "bg-canvas-blue opacity-100"
                    : "opacity-0 group-hover:opacity-50 group-hover:bg-canvas-blue"
                } ${collapsed ? "hidden" : ""}`}
              />
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  isActive ? "text-canvas-blue" : "text-gray-500 group-hover:text-gray-300"
                }`}
                strokeWidth={2}
              />
              {!collapsed && <span>{label}</span>}
              {!collapsed && label === "Inbox" && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-canvas-red px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
              {collapsed && label === "Inbox" && unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-canvas-red" />
              )}
              {collapsed && <NavTip label={label} />}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="mb-2 mt-6 px-5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Actions
          </p>
        )}
        <Link
          to="/settings"
          aria-label="Settings"
          className={navLinkClass(location.pathname === "/settings")}
        >
          <Settings
            className={`h-[18px] w-[18px] shrink-0 ${
              location.pathname === "/settings"
                ? "text-canvas-blue"
                : "text-gray-500 group-hover:text-gray-300"
            }`}
            strokeWidth={2}
          />
          {!collapsed && <span>Settings</span>}
          {collapsed && <NavTip label="Settings" />}
        </Link>
        <Link
          to="/help"
          aria-label="Help"
          className={navLinkClass(location.pathname.startsWith("/help"))}
        >
          <HelpCircle
            className={`h-[18px] w-[18px] shrink-0 ${
              location.pathname.startsWith("/help")
                ? "text-canvas-blue"
                : "text-gray-500 group-hover:text-gray-300"
            }`}
            strokeWidth={2}
          />
          {!collapsed && <span>Help</span>}
          {collapsed && <NavTip label="Help" />}
        </Link>
        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          className={navLinkClass(notificationsOpen)}
        >
          <Bell
            className={`h-[18px] w-[18px] shrink-0 ${
              notificationsOpen
                ? "text-canvas-blue"
                : "text-gray-500 group-hover:text-gray-300"
            }`}
            strokeWidth={2}
          />
          {!collapsed && <span>Notifications</span>}
          {notifUnreadCount > 0 && (
            <span
              className={`rounded-full bg-canvas-red ${
                collapsed
                  ? "absolute right-1 top-1 h-2 w-2"
                  : "ml-auto flex h-5 min-w-[20px] items-center justify-center px-1.5 text-[10px] font-bold text-white"
              }`}
            >
              {!collapsed ? notifUnreadCount : null}
            </span>
          )}
          {collapsed && <NavTip label="Notifications" />}
        </button>
      </div>

      <div className="relative border-t border-white/10 p-2" data-tour="role-toggle">
        <RoleToggle compact={collapsed} />
        <DemoPersonaPicker compact={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`group relative mt-2 flex w-full items-center rounded-lg py-2 text-gray-400 transition hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center" : "gap-2 px-3"
          }`}
        >
          {collapsed ? (
            <>
              <ChevronRight className="h-4 w-4" />
              <NavTip label="Expand sidebar" />
            </>
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-canvas-grayMedium/50 bg-canvas-grayDark px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <AppLogo size={28} variant="mark" />
        <span className="font-semibold text-white">CourseArc</span>
      </div>

      <nav
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-canvas-grayMedium/50 bg-canvas-grayDark transition-all duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:min-h-screen md:translate-x-0 ${
          collapsed ? "w-[68px]" : "w-[240px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400 hover:bg-white/10 md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative flex h-full flex-col">{navContent}</div>
      </nav>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close overlay"
        />
      )}

      <GlobalSearchModal
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        initialQuery={query}
      />

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
}

export function focusGlobalNavSearch() {
  document.querySelector<HTMLInputElement>('[data-tour="nav-search"] input')?.focus();
}

export function openGlobalSearch() {
  window.dispatchEvent(new Event("canvasClone:openGlobalSearch"));
}

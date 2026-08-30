import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import AppLogo from "./AppLogo";
import RoleToggle from "./RoleToggle";
import DemoPersonaPicker from "./DemoPersonaPicker";
import UserAvatar from "./UserAvatar";
import GlobalSearchModal from "./GlobalSearchModal";
import NotificationsPanel from "./NotificationsPanel";
import { studentViewEventName, useStudentView } from "../utils/studentView";
import {
  DEMO_SELF_PERSONA_ID,
  ensureDemoRoster,
  getActiveStudentId,
  setActiveStudentId,
} from "../utils/demoPersona";
import { loadCourses } from "../utils/coursesStore";
import { loadUser, logout } from "../utils/userStore";
import { useSettings } from "../hooks/useSettings";
import { getEffectiveUnreadInboxCount } from "../utils/inbox";
import { getEffectiveUnreadNotificationCount, NOTIFICATIONS_CHANGED_EVENT } from "../utils/notifications";

const NAV_COLLAPSED_KEY = "canvasClone:globalNavCollapsed";

const navItems: { label: string; icon: IconName; path: string }[] = [
  { label: "Dashboard", icon: "home", path: "/" },
  { label: "Courses", icon: "courses", path: "/courses" },
  { label: "Calendar", icon: "calendar", path: "/calendar" },
  { label: "Planner", icon: "planner", path: "/planner" },
  { label: "Inbox", icon: "inbox", path: "/inbox" },
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
            className="pointer-events-none whitespace-nowrap rounded-md bg-arc-ink px-2.5 py-1 text-[11px] font-medium text-arc-cream shadow-lift ring-1 ring-white/10"
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
  const { studentView, viewAs } = useStudentView();
  const settings = useSettings();
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
    if (!getActiveStudentId()) setActiveStudentId(DEMO_SELF_PERSONA_ID);
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
      "group relative flex items-center rounded-md text-[13px] font-medium transition-all",
      collapsed ? "mx-auto w-10 justify-center px-0 py-2.5" : "mx-2.5 gap-3 px-3 py-2.5",
      isActive
        ? "bg-arc-cream/10 text-arc-cream"
        : "text-arc-cream/50 hover:bg-white/5 hover:text-arc-cream",
    ].join(" ");

  const navContent = (
    <>
      <div
        className={`relative border-b border-white/[0.08] ${collapsed ? "px-2 py-4" : "px-5 py-6"}`}
      >
        <Link
          to="/"
          title="CourseArc"
          className={`flex items-center hover:opacity-90 ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <AppLogo size={collapsed ? 32 : 36} variant="mark" />
          {!collapsed && (
            <div>
              <p className="font-display text-[17px] font-medium italic leading-tight text-arc-cream">
                CourseArc
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-arc-gold/80">
                Studio
              </p>
            </div>
          )}
        </Link>
      </div>

      <div
        className={`relative border-b border-white/[0.08] ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}
        data-tour="nav-search"
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label="Search courses"
            className="group relative mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-arc-cream/50 transition hover:bg-white/10 hover:text-arc-cream"
          >
            <Icon name="search" size={16} />
            <NavTip label="Search courses" />
          </button>
        ) : (
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-arc-cream/35">
              <Icon name="search" size={15} />
            </span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search…"
              value={onCoursesCatalog ? query : ""}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (!onCoursesCatalog) setGlobalSearchOpen(true);
              }}
              className="w-full border-0 border-b border-white/15 bg-transparent py-2 pl-7 pr-2 text-sm text-arc-cream placeholder:text-arc-cream/30 focus:border-arc-copper focus:outline-none focus:ring-0"
            />
          </div>
        )}
      </div>

      <div
        className={`relative border-b border-white/[0.08] ${
          collapsed ? "justify-center px-2 py-3" : "gap-3 px-5 py-4"
        }`}
      >
        <Link
          to="/settings"
          aria-label={`${user.name} — Settings`}
          className={`group relative flex min-w-0 items-center rounded-md transition hover:bg-white/5 ${
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
              <p className="truncate text-sm font-medium text-arc-cream">{user.name}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.12em] text-arc-cream/40">
                {studentView ? "Student" : viewAs === "ta" ? "TA" : "Instructor"}
              </p>
            </div>
          )}
        </Link>
      </div>

      <div className="relative flex-1 overflow-hidden py-4">
        {!collapsed && (
          <p className="mb-2 px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-arc-cream/30">
            Navigate
          </p>
        )}
        {navItems.map((item) => {
          const { label, icon, path } = item;
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
                className={`absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 transition-all ${
                  isActive
                    ? "bg-arc-copper opacity-100"
                    : "opacity-0 group-hover:opacity-50 group-hover:bg-arc-gold"
                } ${collapsed ? "hidden" : ""}`}
              />
              <Icon
                name={icon}
                size={16}
                className={isActive ? "text-arc-copper" : "text-arc-cream/40 group-hover:text-arc-cream/80"}
              />
              {!collapsed && <span>{label}</span>}
              {!collapsed && label === "Inbox" && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-arc-brick px-1.5 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
              {collapsed && label === "Inbox" && unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-arc-brick" />
              )}
              {collapsed && <NavTip label={label} />}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="mb-2 mt-6 px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-arc-cream/30">
            Studio
          </p>
        )}
        <Link
          to="/settings"
          aria-label="Settings"
          className={navLinkClass(location.pathname === "/settings")}
        >
          <Icon
            name="settings"
            size={16}
            className={
              location.pathname === "/settings"
                ? "text-arc-copper"
                : "text-arc-cream/40 group-hover:text-arc-cream/80"
            }
          />
          {!collapsed && <span>Settings</span>}
          {collapsed && <NavTip label="Settings" />}
        </Link>
        <Link
          to="/portfolio"
          aria-label="ArcFolio"
          className={navLinkClass(location.pathname.startsWith("/portfolio"))}
        >
          <Icon
            name="portfolio"
            size={16}
            className={
              location.pathname.startsWith("/portfolio")
                ? "text-arc-copper"
                : "text-arc-cream/40 group-hover:text-arc-cream/80"
            }
          />
          {!collapsed && <span>ArcFolio</span>}
          {collapsed && <NavTip label="ArcFolio" />}
        </Link>
        <Link
          to="/help"
          aria-label="Help"
          className={navLinkClass(location.pathname.startsWith("/help"))}
        >
          <Icon
            name="help"
            size={16}
            className={
              location.pathname.startsWith("/help")
                ? "text-arc-copper"
                : "text-arc-cream/40 group-hover:text-arc-cream/80"
            }
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
          <Icon
            name="bell"
            size={16}
            className={
              notificationsOpen
                ? "text-arc-copper"
                : "text-arc-cream/40 group-hover:text-arc-cream/80"
            }
          />
          {!collapsed && <span>Notifications</span>}
          {notifUnreadCount > 0 && (
            <span
              className={`rounded-full bg-arc-brick ${
                collapsed
                  ? "absolute right-1 top-1 h-2 w-2"
                  : "ml-auto flex h-5 min-w-[20px] items-center justify-center px-1.5 text-[10px] font-semibold text-white"
              }`}
            >
              {!collapsed ? notifUnreadCount : null}
            </span>
          )}
          {collapsed && <NavTip label="Notifications" />}
        </button>
      </div>

      <div className="relative border-t border-white/[0.08] p-2" data-tour="role-toggle">
        <RoleToggle compact={collapsed} />
        <DemoPersonaPicker compact={collapsed} />
        {settings.requireLogin && (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { state: { from: location.pathname } });
            }}
            aria-label="Sign out"
            className={`group relative mt-2 flex w-full items-center rounded-md py-2 text-arc-cream/45 transition hover:bg-white/5 hover:text-arc-cream ${
              collapsed ? "justify-center" : "gap-2 px-3"
            }`}
          >
            {collapsed ? (
              <>
                <Icon name="close" size={15} />
                <NavTip label="Sign out" />
              </>
            ) : (
              <span className="text-xs font-medium">Sign out</span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`group relative mt-2 flex w-full items-center rounded-md py-2 text-arc-cream/45 transition hover:bg-white/5 hover:text-arc-cream ${
            collapsed ? "justify-center" : "gap-2 px-3"
          }`}
        >
          {collapsed ? (
            <>
              <Icon name="expandNav" size={15} />
              <NavTip label="Expand sidebar" />
            </>
          ) : (
            <>
              <Icon name="collapse" size={15} />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-arc-moss px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-arc-cream hover:bg-white/10"
          aria-label="Open menu"
        >
          <Icon name="menu" size={18} />
        </button>
        <AppLogo size={28} variant="mark" />
        <span className="font-display text-lg italic text-arc-cream">CourseArc</span>
      </div>

      <nav
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-white/[0.06] bg-arc-moss transition-all duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:min-h-screen md:translate-x-0 ${
          collapsed ? "w-[68px]" : settings.compactNav ? "w-[196px]" : "w-[232px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
          }}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-arc-cream/50 hover:bg-white/10 md:hidden"
          aria-label="Close menu"
        >
          <Icon name="close" size={16} />
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

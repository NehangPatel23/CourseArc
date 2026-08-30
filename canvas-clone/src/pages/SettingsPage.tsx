import { useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ClipboardList,
  GraduationCap,
  ImagePlus,
  Inbox,
  LogOut,
  Megaphone,
  MessageSquare,
  Trash2,
} from "lucide-react";
import DoodleAvatarFace from "../components/DoodleAvatarFace";
import PageIdentityHeader from "../components/PageIdentityHeader";
import UserAvatar from "../components/UserAvatar";
import { useToast } from "../components/ui/Toast";
import { AVATAR_COLORS, initialsFromName } from "../utils/avatar";
import {
  DOODLE_AVATAR_IDS,
  DOODLE_AVATAR_LABELS,
  type DoodleAvatarId,
} from "../utils/avatarDoodles";
import { loadSettings, saveSettings } from "../utils/settingsStore";
import { getDistinctTerms } from "../utils/coursesStore";
import { loadStoredUser, logout, updateProfile } from "../utils/userStore";
import { resetDemoData } from "../utils/demoPersonaSeed";
import {
  downloadSettingsBackup,
  formatStorageUsage,
  isStorageNearQuota,
} from "../utils/localStorageQuota";

const MAX_AVATAR_BYTES = 500_000;

export default function SettingsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings());
  const [user, setUser] = useState(loadStoredUser());
  const fileRef = useRef<HTMLInputElement>(null);
  const terms = getDistinctTerms();

  const patch = (p: Partial<typeof settings>) => {
    const next = saveSettings(p);
    setSettings(next);
    showToast("Settings saved", "positive");
  };

  const saveProfile = () => {
    updateProfile({
      name: user.name,
      email: user.email,
      avatarInitials: user.avatarInitials,
      avatarColor: user.avatarColor,
      avatarImage: user.avatarImage ?? null,
      avatarDoodle: user.avatarDoodle ?? null,
    });
    setUser(loadStoredUser());
    showToast("Profile updated", "positive");
  };

  const selectDoodle = (id: DoodleAvatarId | null) => {
    setUser((u) => ({
      ...u,
      avatarDoodle: id,
      avatarImage: id ? null : u.avatarImage,
    }));
  };

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file", "negative");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast("Image must be under 500KB", "negative");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      setUser((u) => ({ ...u, avatarImage: dataUrl, avatarDoodle: null }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full px-8 py-10 lg:px-12">
      <PageIdentityHeader
        className="mb-8"
        icon="settings"
        label="Settings"
        title="Settings"
        actions={
          <Link to="/" className="text-sm text-canvas-blue hover:underline">
            ← Dashboard
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold text-canvas-grayDark">Profile</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600">Name</span>
            <input
              value={user.name}
              onChange={(e) => {
                const name = e.target.value;
                setUser((u) => ({
                  ...u,
                  name,
                  avatarInitials: u.avatarInitials || initialsFromName(name),
                }));
              }}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Email</span>
            <input
              value={user.email}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            />
          </label>
          <p className="pt-1 text-sm text-gray-600">
            Showcase submitted work on your{" "}
            <Link to="/portfolio" className="text-canvas-blue hover:underline">
              ArcFolio
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 xl:col-span-2">
        <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Avatar</h2>
        <p className="mb-4 text-sm text-gray-600">
          Used in the sidebar and when you are the active demo student. Pick a doodle, use colored
          initials, or upload a photo.
        </p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <UserAvatar
            name={user.name}
            initials={user.avatarInitials}
            color={user.avatarColor}
            imageUrl={user.avatarImage}
            doodleId={user.avatarDoodle}
            size="lg"
          />
          <div className="min-w-0 flex-1 space-y-5">
            <div>
              <p className="mb-2 text-sm text-gray-600">Doodle avatars</p>
              <div className="flex flex-wrap gap-2">
                {DOODLE_AVATAR_IDS.map((id) => {
                  const selected = !user.avatarImage && user.avatarDoodle === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={DOODLE_AVATAR_LABELS[id]}
                      onClick={() => selectDoodle(id)}
                      className={`rounded-full transition ${
                        selected
                          ? "ring-2 ring-canvas-blue ring-offset-2"
                          : "hover:scale-105 hover:ring-2 hover:ring-gray-200"
                      }`}
                    >
                      <DoodleAvatarFace id={id} className="h-10 w-10" />
                    </button>
                  );
                })}
              </div>
              {user.avatarDoodle && !user.avatarImage && (
                <button
                  type="button"
                  onClick={() => selectDoodle(null)}
                  className="mt-2 text-xs text-canvas-blue hover:underline"
                >
                  Clear doodle (use initials)
                </button>
              )}
            </div>

            <label className="block text-sm">
              <span className="text-gray-600">Initials</span>
              <input
                value={user.avatarInitials}
                maxLength={2}
                onChange={(e) =>
                  setUser({
                    ...user,
                    avatarInitials: e.target.value.toUpperCase().slice(0, 2),
                    avatarDoodle: null,
                    avatarImage: null,
                  })
                }
                className="mt-1 w-24 rounded-lg border border-canvas-border px-3 py-2 uppercase tracking-wide"
              />
            </label>
            <div>
              <p className="mb-2 text-sm text-gray-600">Background color</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() =>
                      setUser({
                        ...user,
                        avatarColor: c,
                        avatarDoodle: null,
                        avatarImage: null,
                      })
                    }
                    className={`h-8 w-8 rounded-full transition ${
                      !user.avatarImage &&
                      !user.avatarDoodle &&
                      user.avatarColor === c
                        ? "ring-2 ring-canvas-blue ring-offset-2"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onPickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-white px-3 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
              >
                <ImagePlus className="h-4 w-4" />
                Upload photo
              </button>
              {user.avatarImage && (
                <button
                  type="button"
                  onClick={() => setUser({ ...user, avatarImage: null })}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={saveProfile}
          className="mt-5 rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white"
        >
          Save profile & avatar
        </button>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Dashboard</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600">Default term filter</span>
            <select
              value={settings.activeTerm ?? ""}
              onChange={(e) => patch({ activeTerm: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            >
              <option value="">All terms</option>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showArchivedCourses}
              onChange={(e) => patch({ showArchivedCourses: e.target.checked })}
            />
            Show archived courses
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showCourseCodes}
              onChange={(e) => patch({ showCourseCodes: e.target.checked })}
            />
            Show course codes on dashboard cards
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Date format</span>
            <select
              value={settings.dateFormat}
              onChange={(e) =>
                patch({ dateFormat: e.target.value as "locale" | "numeric" })
              }
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            >
              <option value="locale">Short (Aug 20)</option>
              <option value="numeric">Numeric (08/20/2026)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Default course view</span>
            <select
              value={settings.defaultViewMode}
              onChange={(e) =>
                patch({ defaultViewMode: e.target.value as "grid" | "list" })
              }
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-1 text-lg font-semibold">Notifications</h2>
        <p className="mb-4 text-sm text-gray-600">
          Choose which activity appears in Notifications and Inbox. Direct messages are always delivered.
        </p>
        <div className="divide-y divide-canvas-border/80">
          {(
            [
              {
                key: "notifyInbox" as const,
                title: "Inbox badge",
                description: "Show an unread count on Inbox in the sidebar.",
                Icon: Inbox,
              },
              {
                key: "notifyAnnouncements" as const,
                title: "Announcements",
                description: "New course announcements appear in Notifications and Inbox.",
                Icon: Megaphone,
              },
              {
                key: "notifyDiscussions" as const,
                title: "Discussion replies",
                description: "Replies to your topics and comments arrive as Inbox threads.",
                Icon: MessageSquare,
              },
              {
                key: "notifyGrades" as const,
                title: "Grades posted",
                description: "When grades are released, students get a notification and Inbox note.",
                Icon: GraduationCap,
              },
              {
                key: "notifyAssignments" as const,
                title: "Due reminders",
                description: "Upcoming assignment due dates show in the Notifications panel.",
                Icon: ClipboardList,
              },
              {
                key: "notifyAppointments" as const,
                title: "Appointments",
                description: "Booking, waitlist, and reschedule updates go to Notifications and Inbox.",
                Icon: Calendar,
              },
            ] satisfies {
              key:
                | "notifyInbox"
                | "notifyAnnouncements"
                | "notifyDiscussions"
                | "notifyGrades"
                | "notifyAssignments"
                | "notifyAppointments";
              title: string;
              description: string;
              Icon: ComponentType<{ className?: string }>;
            }[]
          ).map((row) => {
            const on = Boolean(settings[row.key]);
            return (
              <div key={row.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
                  <row.Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-canvas-grayDark">{row.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{row.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={row.title}
                  onClick={() => patch({ [row.key]: !on })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    on ? "bg-canvas-blue" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] ${
                      on ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Appearance</h2>
        <div className="space-y-3 text-sm">
          <fieldset>
            <legend className="mb-2 text-arc-mute">Desk</legend>
            <div className="flex gap-2">
              {(
                [
                  { id: "day", label: "Day studio" },
                  { id: "night", label: "Night desk" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patch({ deskTheme: opt.id })}
                  className={`rounded-md px-3 py-2 text-sm ${
                    settings.deskTheme === opt.id
                      ? "bg-arc-copper text-white"
                      : "bg-arc-ivory ring-1 ring-arc-line text-arc-ink hover:bg-arc-paper"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.compactNav}
              onChange={(e) => patch({ compactNav: e.target.checked })}
            />
            Compact sidebar
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => patch({ reduceMotion: e.target.checked })}
            />
            Reduce motion
          </label>
          <label className="block">
            <span className="text-gray-600">Week starts on</span>
            <select
              value={settings.weekStartsOn}
              onChange={(e) =>
                patch({ weekStartsOn: e.target.value as "sunday" | "monday" })
              }
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Quizzes</h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-gray-600">Quiz UI language</span>
            <select
              value={settings.quizLocale ?? "en"}
              onChange={(e) => patch({ quizLocale: e.target.value as "en" | "es" })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2"
            >
              <option value="en">English</option>
              <option value="es">Español (demo)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Demo data</h2>
        <p className="mb-3 text-sm text-gray-600">
          Re-seed named student submissions (Alex complete, Jordan missing, Sam late) without
          wiping instructor-authored content.
        </p>
        <button
          type="button"
          onClick={() => {
            resetDemoData();
            showToast("Demo roster and submissions reset", "positive");
          }}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
        >
          Reset demo data
        </button>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Storage</h2>
        <p className="mb-2 text-sm text-gray-600">
          This demo stores data in your browser. Usage: {formatStorageUsage()}.
        </p>
        {isStorageNearQuota() && (
          <p className="mb-3 text-sm text-amber-700">
            Storage is nearly full. Export a backup or course packages before adding large banks.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            downloadSettingsBackup();
            showToast("Backup downloaded", "positive");
          }}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
        >
          Download backup JSON
        </button>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-4 text-lg font-semibold">Security</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.requireLogin}
            onChange={(e) => patch({ requireLogin: e.target.checked })}
          />
          Require login to access app
        </label>
        <p className="mt-2 text-sm text-gray-600">
          When this is on, CourseArc shows the sign-in screen until a demo persona is
          chosen. Your profile stays saved after you sign out.
        </p>
        {settings.requireLogin && (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { state: { from: "/settings" } });
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-canvas-grayDark hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        )}
      </section>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, Trash2 } from "lucide-react";
import DoodleAvatarFace from "../components/DoodleAvatarFace";
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
import { loadStoredUser, updateProfile } from "../utils/userStore";

const MAX_AVATAR_BYTES = 500_000;

export default function SettingsPage() {
  const { showToast } = useToast();
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-canvas-grayDark">Settings</h1>
        <Link to="/" className="text-sm text-canvas-blue hover:underline">
          ← Dashboard
        </Link>
      </div>

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
        <h2 className="mb-4 text-lg font-semibold">Notifications</h2>
        <div className="space-y-2 text-sm">
          {[
            ["notifyAssignments", "Assignment due reminders"],
            ["notifyAnnouncements", "New announcements"],
            ["notifyInbox", "Inbox messages"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings[key as keyof typeof settings] as boolean}
                onChange={(e) => patch({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
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
      </section>
      </div>
    </div>
  );
}

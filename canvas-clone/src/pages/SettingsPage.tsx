import { useState } from "react";
import { Link } from "react-router-dom";
import { loadSettings, saveSettings } from "../utils/settingsStore";
import { loadUser, updateProfile } from "../utils/userStore";
import { getDistinctTerms } from "../utils/coursesStore";
import { useToast } from "../components/ui/Toast";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(loadSettings());
  const [user, setUser] = useState(loadUser());
  const terms = getDistinctTerms();

  const patch = (p: Partial<typeof settings>) => {
    const next = saveSettings(p);
    setSettings(next);
    showToast("Settings saved", "positive");
  };

  const saveProfile = () => {
    updateProfile({ name: user.name, email: user.email });
    showToast("Profile updated", "positive");
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-canvas-grayDark dark:text-white">Settings</h1>
        <Link to="/" className="text-sm text-canvas-blue hover:underline">← Dashboard</Link>
      </div>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-4 text-lg font-semibold text-canvas-grayDark dark:text-white">Profile</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Name</span>
            <input
              value={user.name}
              onChange={(e) => setUser({ ...user, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Email</span>
            <input
              value={user.email}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <button type="button" onClick={saveProfile} className="rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white">
            Save profile
          </button>
        </div>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-4 text-lg font-semibold dark:text-white">Appearance</h2>
        <label className="block text-sm">
          <span className="text-gray-600 dark:text-gray-300">Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => patch({ theme: e.target.value as typeof settings.theme })}
            className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-4 text-lg font-semibold dark:text-white">Dashboard</h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Default term filter</span>
            <select
              value={settings.activeTerm ?? ""}
              onChange={(e) => patch({ activeTerm: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All terms</option>
              {terms.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm dark:text-gray-300">
            <input
              type="checkbox"
              checked={settings.showArchivedCourses}
              onChange={(e) => patch({ showArchivedCourses: e.target.checked })}
            />
            Show archived courses
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-300">Default course view</span>
            <select
              value={settings.defaultViewMode}
              onChange={(e) => patch({ defaultViewMode: e.target.value as "grid" | "list" })}
              className="mt-1 w-full rounded-lg border border-canvas-border px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-4 text-lg font-semibold dark:text-white">Notifications</h2>
        <div className="space-y-2 text-sm dark:text-gray-300">
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

      <section className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-4 text-lg font-semibold dark:text-white">Security</h2>
        <label className="flex items-center gap-2 text-sm dark:text-gray-300">
          <input
            type="checkbox"
            checked={settings.requireLogin}
            onChange={(e) => patch({ requireLogin: e.target.checked })}
          />
          Require login to access app
        </label>
      </section>
    </div>
  );
}

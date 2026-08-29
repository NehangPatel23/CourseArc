import { useEffect, useState } from "react";
import CanvasModal from "./CanvasModal";
import type { RosterRole } from "../utils/courseRoster";

type Props = {
  onClose: () => void;
  onAdd: (input: { name: string; email?: string; role: RosterRole }) => void;
  allowedRoles?: RosterRole[];
};

export default function AddPersonModal({ onClose, onAdd, allowedRoles }: Props) {
  const roles: RosterRole[] = allowedRoles ?? ["student", "ta", "instructor"];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RosterRole>(roles[0] ?? "student");

  useEffect(() => {
    document.getElementById("add-person-name")?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      email: email.trim() || undefined,
      role,
    });
    onClose();
  };

  return (
    <CanvasModal title="Add person" onClose={onClose} size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="add-person-name" className="mb-1 block text-sm font-medium text-canvas-grayDark">
            Full name
          </label>
          <input
            id="add-person-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="e.g., Jordan Lee"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 outline-none focus:border-canvas-blue focus:ring-1 focus:ring-canvas-blue"
          />
        </div>

        <div>
          <label htmlFor="add-person-email" className="mb-1 block text-sm font-medium text-canvas-grayDark">
            Email <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="add-person-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="name@example.edu"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-canvas-grayDark placeholder-gray-400 outline-none focus:border-canvas-blue focus:ring-1 focus:ring-canvas-blue"
          />
        </div>

        <div>
          <label htmlFor="add-person-role" className="mb-1 block text-sm font-medium text-canvas-grayDark">
            Role
          </label>
          {roles.length === 1 ? (
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-canvas-grayDark">
              Student
            </p>
          ) : (
            <select
              id="add-person-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RosterRole)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-canvas-grayDark outline-none focus:border-canvas-blue focus:ring-1 focus:ring-canvas-blue"
            >
              {roles.includes("student") && <option value="student">Student</option>}
              {roles.includes("ta") && <option value="ta">TA</option>}
              {roles.includes("instructor") && <option value="instructor">Instructor</option>}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-canvas-grayDark transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="rounded-md bg-canvas-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-canvas-blueDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to course
          </button>
        </div>
      </div>
    </CanvasModal>
  );
}

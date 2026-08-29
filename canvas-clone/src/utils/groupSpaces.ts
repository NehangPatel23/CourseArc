export const GROUP_SPACE_CHANGED_EVENT = "canvasClone:groupSpaceChanged";

export type GroupAnnouncement = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  author: string;
  createdAt: number;
};

export type GroupPost = {
  id: string;
  body: string;
  authorId: string;
  author: string;
  createdAt: number;
  parentId?: string;
};

export type GroupFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
  uploadedBy: string;
  uploadedById: string;
  uploadedAt: number;
};

export type GroupSpace = {
  announcements: GroupAnnouncement[];
  posts: GroupPost[];
  files: GroupFile[];
};

export const MAX_GROUP_FILE_BYTES = 800_000;

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

export function groupSpaceKey(courseId: string, groupId: string) {
  return `canvasClone:groupSpace:${courseId}:${groupId}`;
}

function emptySpace(): GroupSpace {
  return { announcements: [], posts: [], files: [] };
}

function persist(courseId: string, groupId: string, space: GroupSpace) {
  try {
    window.localStorage.setItem(groupSpaceKey(courseId, groupId), JSON.stringify(space));
    window.dispatchEvent(new Event(GROUP_SPACE_CHANGED_EVENT));
  } catch {}
}

export function loadGroupSpace(courseId: string, groupId: string): GroupSpace {
  try {
    const raw = window.localStorage.getItem(groupSpaceKey(courseId, groupId));
    if (!raw) return emptySpace();
    const parsed = JSON.parse(raw) as Partial<GroupSpace>;
    return {
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
    };
  } catch {
    return emptySpace();
  }
}

export function replaceGroupSpace(courseId: string, groupId: string, space: GroupSpace) {
  persist(courseId, groupId, {
    announcements: space.announcements ?? [],
    posts: space.posts ?? [],
    files: space.files ?? [],
  });
}

export function exportGroupSpaces(courseId: string): Record<string, GroupSpace> {
  const out: Record<string, GroupSpace> = {};
  try {
    const prefix = `canvasClone:groupSpace:${courseId}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const groupId = key.slice(prefix.length);
      out[groupId] = loadGroupSpace(courseId, groupId);
    }
  } catch {}
  return out;
}

export function importGroupSpaces(courseId: string, spaces: Record<string, GroupSpace>) {
  if (!spaces || typeof spaces !== "object") return;
  for (const [groupId, space] of Object.entries(spaces)) {
    if (!groupId) continue;
    replaceGroupSpace(courseId, groupId, space);
  }
}

export function addGroupAnnouncement(
  courseId: string,
  groupId: string,
  input: { title: string; body: string; authorId: string; author: string },
): GroupAnnouncement {
  const space = loadGroupSpace(courseId, groupId);
  const row: GroupAnnouncement = {
    id: uid("gann"),
    title: input.title.trim() || "Announcement",
    body: input.body.trim(),
    authorId: input.authorId,
    author: input.author,
    createdAt: Date.now(),
  };
  persist(courseId, groupId, { ...space, announcements: [row, ...space.announcements] });
  return row;
}

export function deleteGroupAnnouncement(courseId: string, groupId: string, id: string) {
  const space = loadGroupSpace(courseId, groupId);
  persist(courseId, groupId, {
    ...space,
    announcements: space.announcements.filter((a) => a.id !== id),
  });
}

export function addGroupPost(
  courseId: string,
  groupId: string,
  input: { body: string; authorId: string; author: string; parentId?: string },
): GroupPost | null {
  const body = input.body.trim();
  if (!body) return null;
  const space = loadGroupSpace(courseId, groupId);
  const row: GroupPost = {
    id: uid("gpost"),
    body,
    authorId: input.authorId,
    author: input.author,
    createdAt: Date.now(),
    parentId: input.parentId,
  };
  persist(courseId, groupId, { ...space, posts: [...space.posts, row] });
  return row;
}

export function addGroupFile(
  courseId: string,
  groupId: string,
  file: GroupFile,
): GroupFile {
  const space = loadGroupSpace(courseId, groupId);
  persist(courseId, groupId, { ...space, files: [file, ...space.files] });
  return file;
}

export function deleteGroupFile(courseId: string, groupId: string, id: string) {
  const space = loadGroupSpace(courseId, groupId);
  persist(courseId, groupId, { ...space, files: space.files.filter((f) => f.id !== id) });
}

export function fileToGroupFile(
  file: File,
  uploader: { id: string; name: string },
): Promise<GroupFile> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_GROUP_FILE_BYTES) {
      reject(new Error(`“${file.name}” is too large (max 800 KB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: uid("gfile"),
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result ?? ""),
        uploadedBy: uploader.name,
        uploadedById: uploader.id,
        uploadedAt: Date.now(),
      });
    };
    reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
    reader.readAsDataURL(file);
  });
}

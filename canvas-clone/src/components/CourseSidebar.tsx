import { Link, useLocation, useParams } from "react-router-dom";
import { Home, FileText, Layers, Folder, Megaphone } from "lucide-react";

export default function CourseSidebar() {
  const { courseId } = useParams();
  const location = useLocation();

  if (!courseId) return null;

  const base = `/courses/${courseId}`;
  const items = [
    { label: "Home", icon: Home, path: `${base}` },
    { label: "Announcements", icon: Megaphone, path: `${base}/announcements` },
    { label: "Modules", icon: Layers, path: `${base}/modules` },
    { label: "Pages", icon: FileText, path: `${base}/pages` },
    { label: "Files", icon: Folder, path: `${base}/files` },
  ];

  return (
    <nav className="bg-white border-r border-canvas-border w-[220px] flex flex-col py-6">
      <h2 className="px-6 pb-6 text-sm font-semibold text-gray-600 tracking-wide uppercase">
        Course Navigation
      </h2>

      {items.map(({ label, icon: Icon, path }) => {
        const isActive =
          location.pathname === path ||
          (label === "Home" && location.pathname === base) ||
          (label !== "Home" && location.pathname.startsWith(path));

        return (
          <Link
            key={label}
            to={path}
            className={`group relative flex items-center gap-3 py-3 pl-6 pr-3 text-[15px] font-medium transition-all ${
              isActive
                ? "text-canvas-blue bg-[#F2FAFF]"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            <div
              className={`absolute left-0 top-0 h-full w-[3px] rounded-r-md transition-all ${
                isActive
                  ? "bg-canvas-blue opacity-100"
                  : "opacity-0 group-hover:opacity-40 group-hover:bg-canvas-blue"
              }`}
            />

            <Icon
              className={`w-5 h-5 ${
                isActive
                  ? "text-canvas-blue"
                  : "text-gray-400 group-hover:text-gray-600"
              }`}
            />
            {label}

            <div className="absolute left-[100%] ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white text-[#2D3B45] text-xs rounded shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 ease-out whitespace-nowrap z-50">
              {label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

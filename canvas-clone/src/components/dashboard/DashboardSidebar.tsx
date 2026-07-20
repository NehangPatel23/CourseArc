import { ChevronDown, ChevronUp } from "lucide-react";
import { WIDGET_REGISTRY, WIDGET_LABELS } from "./widgetRegistry";
import DashboardCustomizer from "./DashboardCustomizer";
import type { WidgetId } from "../../utils/dashboardLayout";

type Props = {
  widgets: WidgetId[];
  hidden: WidgetId[];
  collapsed: WidgetId[];
  studentView: boolean;
  onToggle: (id: WidgetId) => void;
  onReorder: (widgets: WidgetId[]) => void;
  onToggleVisibility: (id: WidgetId) => void;
  onReset: () => void;
};

export default function DashboardSidebar({
  widgets,
  hidden,
  collapsed,
  studentView,
  onToggle,
  onReorder,
  onToggleVisibility,
  onReset,
}: Props) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-canvas-grayDark">Panels</h3>
        <DashboardCustomizer
          widgets={widgets}
          hidden={hidden}
          onReorder={onReorder}
          onToggleVisibility={onToggleVisibility}
          onReset={onReset}
          studentView={studentView}
        />
      </div>

      {widgets.length === 0 ? (
        <div className="dashboard-card p-5 text-center">
          <p className="text-sm text-gray-500">No panels visible.</p>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 rounded-lg bg-canvas-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-canvas-blueDark"
          >
            Restore recommended panels
          </button>
        </div>
      ) : (
        widgets.map((id) => {
          const Widget = WIDGET_REGISTRY[id];
          if (!Widget) return null;
          const isCollapsed = collapsed.includes(id);
          return (
            <div key={id} className="dashboard-card overflow-hidden">
              <button
                type="button"
                onClick={() => onToggle(id)}
                className="flex w-full items-center justify-between border-b border-transparent px-5 py-3.5 text-left transition-colors hover:bg-gray-50/80"
                aria-expanded={!isCollapsed}
              >
                <span className="text-sm font-semibold text-canvas-grayDark">
                  {WIDGET_LABELS[id]}
                </span>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {!isCollapsed && (
                <div className="px-5 pb-5 pt-1">
                  <Widget
                    studentView={studentView}
                    collapsed={isCollapsed}
                    onToggle={() => onToggle(id)}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </aside>
  );
}

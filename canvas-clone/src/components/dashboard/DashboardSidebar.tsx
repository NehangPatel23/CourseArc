import { ChevronDown, ChevronUp, LayoutPanelLeft } from "lucide-react";
import { WIDGET_REGISTRY, WIDGET_LABELS } from "./widgetRegistry";
import DashboardCustomizer from "./DashboardCustomizer";
import AppErrorBoundary from "../AppErrorBoundary";
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
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-blueTint text-canvas-blue">
            <LayoutPanelLeft className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-canvas-blue">Panels</h3>
        </div>
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
        <div className="dashboard-card p-5 text-center shadow-sm">
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
            <div
              key={id}
              className="dashboard-card overflow-hidden shadow-sm transition hover:ring-canvas-blue/20"
            >
              <button
                type="button"
                onClick={() => onToggle(id)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-canvas-blueTint/40"
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
                <div className="border-t border-gray-100 px-5 pb-5 pt-3">
                  <AppErrorBoundary fallbackTitle={`${WIDGET_LABELS[id]} couldn't load`}>
                    <Widget
                      studentView={studentView}
                      collapsed={isCollapsed}
                      onToggle={() => onToggle(id)}
                    />
                  </AppErrorBoundary>
                </div>
              )}
            </div>
          );
        })
      )}
    </aside>
  );
}

import Icon from "../../icons/Icon";
import { notify } from "../ui/Toast";
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
    <aside className="flex flex-col xl:border-l xl:border-arc-ink/10 xl:pl-10">
      <div className="mb-6 flex items-end justify-between gap-2 border-b border-arc-ink/15 pb-3">
        <div>
          <p className="kicker">Studio</p>
          <h3 className="font-display mt-1 text-xl font-medium text-arc-ink">Desk</h3>
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
        <div className="py-6 text-center">
          <p className="text-sm text-arc-mute">No panels on the desk.</p>
          <button
            type="button"
            onClick={() => {
              onReset();
              notify("Dashboard layout reset", "layout");
            }}
            className="mt-3 text-sm text-arc-copper hover:underline"
          >
            Restore recommended panels
          </button>
        </div>
      ) : (
        <div className="flex flex-col">
          {widgets.map((id) => {
            const Widget = WIDGET_REGISTRY[id];
            if (!Widget) return null;
            const isCollapsed = collapsed.includes(id);
            return (
              <div key={id} className="border-b border-arc-ink/10 py-4">
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={!isCollapsed}
                >
                  <span className="font-display text-[17px] font-medium italic text-arc-ink">
                    {WIDGET_LABELS[id]}
                  </span>
                  <Icon
                    name={isCollapsed ? "chevronDown" : "chevronUp"}
                    size={12}
                    className="text-arc-mute"
                  />
                </button>
                {!isCollapsed && (
                  <div className="mt-3">
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
          })}
        </div>
      )}
    </aside>
  );
}

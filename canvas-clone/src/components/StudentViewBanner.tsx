import Icon from "../icons/Icon";

type Props = {
  label?: string;
  tone?: "student" | "ta";
  className?: string;
};

export default function StudentViewBanner({
  label,
  tone = "student",
  className = "",
}: Props) {
  const copper = tone === "student";
  return (
    <div
      className={`flex items-center gap-2 border-b px-8 py-2.5 lg:px-14 ${
        copper
          ? "border-arc-copper/25 text-arc-copper"
          : "border-arc-sage/30 text-arc-sage"
      } ${className}`}
    >
      <Icon name={copper ? "eye" : "ta"} size={12} />
      <span className={`kicker ${copper ? "text-arc-copper" : "text-arc-sage"}`}>
        {label ?? (copper ? "Viewing as a student" : "Viewing as a TA")}
      </span>
    </div>
  );
}

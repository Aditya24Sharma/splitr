/** The app's arrow: a chevron, pointing back (left) or onward (right). */
export function Chevron({ direction, className = "w-5 h-5" }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.25">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

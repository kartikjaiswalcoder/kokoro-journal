import { useEffect, useRef, useState } from "react";

export default function ScrollingSongTitle({ title }: { title: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const measure = () => {
      if (viewport.current && text.current) setOverflow(text.current.offsetWidth > viewport.current.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (text.current) observer.observe(text.current);
    return () => observer.disconnect();
  }, [title]);
  return <div ref={viewport} className="song-title-viewport text-xs 2xl:text-sm font-semibold text-charcoal" title={title}>
    <div className={overflow ? "song-title-loop" : "song-title-static"}>
      <span ref={text}>{title}</span>
      {overflow && <span aria-hidden="true">{title}</span>}
    </div>
  </div>;
}
import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

interface Props {
  chart: string;
}

// Mermaid is large, so it is loaded only when a document contains a diagram.
export default function MermaidDiagram({ chart }: Props) {
  const { resolvedTheme } = useTheme();
  const id = "mermaid-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const result = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Invalid diagram");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (error)
    return (
      <div>
        <p className="text-xs text-[var(--destructive)]">Diagram could not be rendered: {error}</p>
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    );
  if (!svg)
    return (
      <pre>
        <code>{chart}</code>
      </pre>
    );
  return (
    <div
      className="my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
      // Rendered by mermaid with securityLevel "strict", which sanitizes labels and disables scripts.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

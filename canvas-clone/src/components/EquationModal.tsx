import { useEffect, useRef, useState, type ChangeEvent, type FC } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface EquationModalProps {
  isOpen: boolean;
  initialLatex?: string;
  initialDisplay?: "inline" | "block";
  onInsert: (latex: string, display: "inline" | "block") => void;
  onClose: () => void;
}

type SymbolButton = {
  label: string;
  latex: string;
  title?: string;
};

type TabId =
  | "basic"
  | "greek"
  | "operators"
  | "relations"
  | "arrows"
  | "delimiters"
  | "misc";

const SYMBOL_PALETTE: Record<
  TabId,
  { title: string; symbols: SymbolButton[] }
> = {
  basic: {
    title: "Basic",
    symbols: [
      { label: "x²", latex: "x^2", title: "x squared" },
      { label: "xᵢ", latex: "x_i", title: "subscript" },
      { label: "√", latex: "\\sqrt{}", title: "square root" },
      { label: "∑", latex: "\\sum", title: "summation" },
      { label: "∏", latex: "\\prod", title: "product" },
      { label: "∫", latex: "\\int", title: "integral" },
      { label: "∞", latex: "\\infty", title: "infinity" },
      { label: "π", latex: "\\pi", title: "pi" },
      { label: "e", latex: "e", title: "e" },
      { label: "ln", latex: "\\ln", title: "natural log" },
    ],
  },
  greek: {
    title: "Greek",
    symbols: [
      { label: "α", latex: "\\alpha" },
      { label: "β", latex: "\\beta" },
      { label: "γ", latex: "\\gamma" },
      { label: "δ", latex: "\\delta" },
      { label: "ε", latex: "\\epsilon" },
      { label: "θ", latex: "\\theta" },
      { label: "λ", latex: "\\lambda" },
      { label: "μ", latex: "\\mu" },
      { label: "σ", latex: "\\sigma" },
      { label: "ω", latex: "\\omega" },
      { label: "Δ", latex: "\\Delta" },
      { label: "Σ", latex: "\\Sigma" },
      { label: "Ω", latex: "\\Omega" },
    ],
  },
  operators: {
    title: "Operators",
    symbols: [
      { label: "+", latex: "+" },
      { label: "−", latex: "-" },
      { label: "×", latex: "\\cdot" },
      { label: "÷", latex: "\\frac{}", title: "fraction" },
      { label: "±", latex: "\\pm" },
      { label: "⋅", latex: "\\cdot" },
      { label: "∂", latex: "\\partial" },
      { label: "∇", latex: "\\nabla" },
      { label: "′", latex: "\\prime" },
      { label: "!", latex: "!" },
    ],
  },
  relations: {
    title: "Relationships",
    symbols: [
      { label: "=", latex: "=" },
      { label: "≠", latex: "\\neq" },
      { label: "<", latex: "<" },
      { label: "≤", latex: "\\leq" },
      { label: ">", latex: ">" },
      { label: "≥", latex: "\\geq" },
      { label: "≈", latex: "\\approx" },
      { label: "∝", latex: "\\propto" },
      { label: "∈", latex: "\\in" },
      { label: "∉", latex: "\\notin" },
      { label: "⊂", latex: "\\subset" },
      { label: "⊆", latex: "\\subseteq" },
    ],
  },
  arrows: {
    title: "Arrows",
    symbols: [
      { label: "→", latex: "\\to" },
      { label: "←", latex: "\\leftarrow" },
      { label: "⇒", latex: "\\Rightarrow" },
      { label: "⇐", latex: "\\Leftarrow" },
      { label: "↔", latex: "\\leftrightarrow" },
      { label: "⇔", latex: "\\Leftrightarrow" },
    ],
  },
  delimiters: {
    title: "Delimiters",
    symbols: [
      { label: "( )", latex: "\\left(  \\right)" },
      { label: "[ ]", latex: "\\left[  \\right]" },
      { label: "{ }", latex: "\\left\\{  \\right\\}" },
      { label: "| |", latex: "\\left|  \\right|" },
      { label: "⟨ ⟩", latex: "\\left\\langle  \\right\\rangle" },
    ],
  },
  misc: {
    title: "Misc",
    symbols: [
      { label: "ℕ", latex: "\\mathbb{N}" },
      { label: "ℤ", latex: "\\mathbb{Z}" },
      { label: "ℚ", latex: "\\mathbb{Q}" },
      { label: "ℝ", latex: "\\mathbb{R}" },
      { label: "ℂ", latex: "\\mathbb{C}" },
      { label: "⊕", latex: "\\oplus" },
      { label: "⊗", latex: "\\otimes" },
      { label: "⌊ ⌋", latex: "\\lfloor  \\rfloor" },
      { label: "⌈ ⌉", latex: "\\lceil  \\rceil" },
    ],
  },
};

const EquationModal: FC<EquationModalProps> = ({
  isOpen,
  initialLatex = "",
  initialDisplay = "inline",
  onInsert,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [latexText, setLatexText] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<"inline" | "block">("inline");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLatexText(initialLatex || "");
    setDisplayMode(initialDisplay);
    setActiveTab("basic");
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 40);
    return () => clearTimeout(t);
  }, [isOpen, initialLatex, initialDisplay]);

  // live KaTeX preview
  useEffect(() => {
    if (!latexText.trim()) {
      setPreviewHtml("");
      setPreviewError(null);
      return;
    }
    try {
      const html = katex.renderToString(latexText, {
        throwOnError: false,
        displayMode: displayMode === "block",
      });
      setPreviewHtml(html);
      setPreviewError(null);
    } catch (err) {
      setPreviewHtml("");
      setPreviewError("Could not render this LaTeX.");
    }
  }, [latexText, displayMode]);

  if (!isOpen) return null;

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setLatexText(e.target.value);
  };

  const insertAtCaret = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setLatexText((prev) => prev + snippet);
      return;
    }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = latexText.slice(0, start);
    const after = latexText.slice(end);
    const next = before + snippet + after;

    setLatexText(next);

    requestAnimationFrame(() => {
      const newPos = start + snippet.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  const handleInsertClick = () => {
    const trimmed = latexText.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    onInsert(trimmed, displayMode);
    onClose();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "basic", label: "Basic" },
    { id: "greek", label: "Greek" },
    { id: "operators", label: "Operators" },
    { id: "relations", label: "Relationships" },
    { id: "arrows", label: "Arrows" },
    { id: "delimiters", label: "Delimiters" },
    { id: "misc", label: "Misc" },
  ];

  const currentTab = SYMBOL_PALETTE[activeTab];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-5 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Equation Editor
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Click symbols to insert them, edit the LaTeX, and choose whether the equation
          flows inline with text or appears as a centered block.
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDisplayMode("inline")}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              displayMode === "inline"
                ? "border-canvas-blue bg-canvas-blue/10 text-canvas-blue font-medium"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Inline
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("block")}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              displayMode === "block"
                ? "border-canvas-blue bg-canvas-blue/10 text-canvas-blue font-medium"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Block (centered)
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-3 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 -mb-px border-b-2 ${
                activeTab === tab.id
                  ? "border-canvas-blue text-canvas-blue font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Symbol grid */}
        <div className="mb-3">
          <div className="grid grid-cols-10 gap-1">
            {currentTab.symbols.map((sym, idx) => (
              <button
                key={`${currentTab.title}-${idx}-${sym.latex}`}
                type="button"
                title={sym.title ?? sym.latex}
                onClick={() => insertAtCaret(sym.latex)}
                className="h-8 flex items-center justify-center border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 text-xs text-gray-800 px-1"
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>

        {/* LaTeX text box */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Directly Edit LaTeX
          </label>
          <textarea
            ref={textareaRef}
            value={latexText}
            onChange={handleChange}
            className="w-full min-h-[90px] border border-gray-300 rounded-md px-3 py-2 text-sm font-mono text-gray-800 resize-vertical focus:outline-none focus:ring-1 focus:ring-canvas-blue focus:border-canvas-blue"
            placeholder={`Example: \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`}
          />
        </div>

        {/* Live preview */}
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-medium text-gray-600">Preview</span>
            {previewError && (
              <span className="text-[11px] text-red-500">{previewError}</span>
            )}
          </div>
          <div className="min-h-[40px] border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
            {previewHtml ? (
              <div
                className="katex-preview text-base"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <span className="text-[11px] text-gray-400">
                Start typing LaTeX above to see a preview.
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsertClick}
            className="px-4 py-1.5 text-sm rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark"
          >
            Insert Equation
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquationModal;

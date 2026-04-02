"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedLineItem {
  itemName: string;
  description: string;
  unit: string;
  qty: number;
  usdUnitPrice: number;
  isFree: boolean;
  sortOrder: number;
}

interface ParsedScreenInfo {
  screenWidthMm: number | null;
  screenHeightMm: number | null;
  pixelPitchMm: number | null;
  cabinetWidthMm: number | null;
  cabinetHeightMm: number | null;
  panelCountW: number | null;
  panelCountH: number | null;
  resolutionW: number | null;
  resolutionH: number | null;
  brightnessNits: number | null;
  cabinetWeightKg: number | null;
}

interface ParsedQuote {
  sheetName: string;
  name: string;
  supplierQuoteRef: string;
  supplierQuoteDate: string;
  screenSize: string;
  panelConfig: string;
  totalResolution: string;
  screenInfo: ParsedScreenInfo;
  lineItems: ParsedLineItem[];
  totalUsd: number;
  /** Total read directly from the XLS "Total Amount" row — used for validation */
  xlsTotalUsd: number;
}

interface Client {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  clientId: number;
}

interface ExistingQuote {
  id: number;
  quoteNumber: string;
  name: string;
}

// ─── XLS Parser ───────────────────────────────────────────────────────────────

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedQuote {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  function cell(row: number, col: number): string {
    const r = raw[row] as unknown[];
    if (!r) return "";
    const v = r[col];
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function cellNum(row: number, col: number): number {
    const r = raw[row] as unknown[];
    if (!r) return 0;
    const v = r[col];
    if (v === null || v === undefined || v === "") return 0;
    const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function rowAsStrings(rowIdx: number): string[] {
    const r = raw[rowIdx] as unknown[];
    if (!r) return [];
    return r.map((v) => (v === null || v === undefined ? "" : String(v).toLowerCase().trim()));
  }

  // ── Detect column layout from header row ──────────────────────────────────
  // Scan rows 0-25 looking for a row that mentions "product name" and "qty" or "quantity"
  let headerRowIdx = -1;
  let colName = 0;
  let colDesc = 4;
  let colUnit = 5;
  let colQty = 7;
  let colUnitPrice = 8;
  let colSubTotal = 10;
  let colRemarks = -1;

  for (let r = 0; r < Math.min(raw.length, 25); r++) {
    const strs = rowAsStrings(r);
    const nameIdx = strs.findIndex((s) => s.includes("product") && (s.includes("name") || s === "product name"));
    if (nameIdx < 0) continue;

    // Found a header row — map the other columns
    headerRowIdx = r;
    colName = nameIdx;

    const qtyIdx = strs.findIndex((s, i) => i > nameIdx && (s === "qty" || s === "quantity"));
    const priceIdx = strs.findIndex((s, i) => i > nameIdx && s.includes("unit price"));
    const totalIdx = strs.findIndex((s, i) => i > nameIdx && (s.includes("sub total") || s.includes("total price")));
    const unitIdx = strs.findIndex((s, i) => i > nameIdx && s === "unit");
    const descIdx = strs.findIndex((s, i) => i > nameIdx && (s === "description" || s === "item no" || s === "item no."));
    const remarksIdx = strs.findIndex((s, i) => i > nameIdx && (s === "remarks" || s === "remark" || s === "notes" || s === "note"));

    if (qtyIdx > 0) colQty = qtyIdx;
    if (priceIdx > 0) colUnitPrice = priceIdx;
    if (totalIdx > 0) colSubTotal = totalIdx;
    if (unitIdx > 0) colUnit = unitIdx;
    if (descIdx > 0) colDesc = descIdx;
    if (remarksIdx > 0) colRemarks = remarksIdx;
    break;
  }

  // ── Extract header metadata ────────────────────────────────────────────────
  // Scan ALL columns in the metadata area (not just col 0) for label patterns.
  // Also handle Leyard's multi-cell structured layout where values are in
  // separate cells (e.g. "Actual Size:" in col 1, width in col 4, "m(W)x" in col 5, etc.)
  let supplierQuoteDate = "";
  let supplierQuoteRef = "";
  let name = sheetName;
  let screenSize = "";
  let panelConfig = "";
  let totalResolution = "";

  let pixelPitchRaw = "";
  let brightnessRaw = "";
  let cabinetSizeRaw = "";
  let cabinetWeightRaw = "";

  const metaEnd = Math.min(raw.length, headerRowIdx > 0 ? headerRowIdx : 20);

  for (let r = 0; r < metaEnd; r++) {
    const rowArr = raw[r] as unknown[];
    if (!rowArr) continue;

    // Build a concatenated string of all cells in this row for matching
    // Also check each cell individually for label:value patterns
    for (let c = 0; c < rowArr.length; c++) {
      const cv = rowArr[c];
      if (cv === null || cv === undefined || cv === "") continue;
      const cs = String(cv).trim();
      const cl = cs.toLowerCase();

      // ── Date (may be a text label like "Date:" or just "Date:" header with value in next col) ──
      if (cl === "date:" || cl === "date") {
        // Value in the next populated cell — could be text or Excel serial number
        for (let nc = c + 1; nc < rowArr.length; nc++) {
          const nv = rowArr[nc];
          if (nv === null || nv === undefined || nv === "") continue;
          if (typeof nv === "number" && nv > 40000 && nv < 60000) {
            // Excel serial number — convert to ISO date
            const epoch = new Date(1899, 11, 30);
            epoch.setDate(epoch.getDate() + nv);
            supplierQuoteDate = epoch.toISOString().split("T")[0];
          } else {
            supplierQuoteDate = String(nv).trim();
          }
          break;
        }
      } else if (cl.startsWith("date:") && cl.length > 5) {
        supplierQuoteDate = cs.replace(/^date:\s*/i, "").trim();
      }

      // ── Quote ref ──
      if (cl.startsWith("quote ") && !cl.startsWith("quotation")) {
        supplierQuoteRef = cs;
        name = cs.replace(/^quote\s+/i, "").trim() || sheetName;
      } else if (cl.startsWith("quotation ") && !supplierQuoteRef) {
        supplierQuoteRef = cs;
      }

      // ── Project Name (Leyard format: "Project Name: ...") ──
      if (cl.startsWith("project name:") || cl.startsWith("project name :")) {
        const projName = cs.replace(/^project\s+name\s*:\s*/i, "").trim();
        if (projName) name = projName;
      }

      // ── Screen size (text label format) ──
      if (cl.startsWith("required screen size:")) screenSize = cs.replace(/^required screen size:\s*/i, "").trim();

      // ── Required panel qty (text label format) ──
      if (cl.startsWith("required panel qty:")) panelConfig = cs.replace(/^required panel qty:\s*/i, "").trim();

      // ── Total resolution (text label format) ──
      if (cl.startsWith("total resolution:")) totalResolution = cs.replace(/^total resolution:\s*/i, "").trim();

      // ── Pixel pitch (may be in any column, e.g. "Pixel Pitch :2.5 mm") ──
      if (cl.startsWith("pixel pitch") || cl.startsWith("pitch:")) {
        const ppVal = cs.replace(/^(pixel\s+)?pitch\s*:\s*/i, "").trim();
        if (ppVal) pixelPitchRaw = ppVal;
      }

      // ── Cabinet/module/panel size (e.g. "Cabinet Size : 600mm(W) x 337.5mm(H)*45mm(T)") ──
      if (/^(cabinet|module|panel)\s+size\s*:/i.test(cs)) {
        cabinetSizeRaw = cs.replace(/^(cabinet|module|panel)\s+size\s*:\s*/i, "").trim();
      }

      // ── Cabinet/module/panel weight ──
      if (/^(cabinet|module|panel)\s+weight\s*:/i.test(cs)) {
        cabinetWeightRaw = cs.replace(/^(cabinet|module|panel)\s+weight\s*:\s*/i, "").trim();
      }

      // ── Brightness ──
      if (cl.startsWith("brightness:")) brightnessRaw = cs.replace(/^brightness:\s*/i, "").trim();

      // ── Leyard multi-cell structured rows ──
      // Pattern: label in one cell, numeric values in subsequent cells
      // e.g. "Actual Size:" | ... | 4.8 | "m(W)x" | 3.0375 | "m(H)"
      // e.g. "Screen resolution:" | ... | 1920 | "pixel(W)x" | 1215 | "pixel(H)"
      // e.g. "Arrangement of cabinet:" | ... | 8 | "(W)x" | 9 | "(H)"

      if (cl.includes("actual size") || cl.includes("actual display size")) {
        // Look for numeric width and height values in the row
        const vals: number[] = [];
        for (let vc = c + 1; vc < rowArr.length; vc++) {
          const vv = rowArr[vc];
          if (typeof vv === "number" && vv > 0) vals.push(vv);
          else if (typeof vv === "string") {
            const n = parseFloat(vv);
            if (!isNaN(n) && n > 0) vals.push(n);
          }
        }
        if (vals.length >= 2) {
          // First two positive numbers are width and height
          const w = vals[0];
          const h = vals[1];
          // Check unit from adjacent cells — look for "m(W)" or "mm"
          const rowText = rowArr.map((v) => String(v ?? "").toLowerCase()).join(" ");
          const isMetres = rowText.includes("m(w)") || (rowText.includes("(w)") && !rowText.includes("mm(w)"));
          screenSize = isMetres ? `${w}m x ${h}m` : `${w}mm x ${h}mm`;
        }
      }

      if (cl.includes("screen resolution") || cl.includes("total resolution")) {
        const vals: number[] = [];
        for (let vc = c + 1; vc < rowArr.length; vc++) {
          const vv = rowArr[vc];
          if (typeof vv === "number" && vv > 0) vals.push(vv);
        }
        if (vals.length >= 2) {
          totalResolution = `${vals[0]} x ${vals[1]}`;
        }
      }

      if (cl.includes("arrangement") || cl.includes("panel layout") || cl.includes("cabinet layout")) {
        const vals: number[] = [];
        for (let vc = c + 1; vc < rowArr.length; vc++) {
          const vv = rowArr[vc];
          if (typeof vv === "number" && vv > 0 && Number.isInteger(vv)) vals.push(vv);
        }
        if (vals.length >= 2) {
          panelConfig = `${vals[0]}W x ${vals[1]}H`;
        }
      }

      // ── Leyard "Required Display Size:" (separate from "Actual Size") ──
      if (cl.includes("required display size") || cl.includes("required screen size")) {
        if (!screenSize) {
          // Only use this if we haven't already found the actual size
          const vals: number[] = [];
          for (let vc = c + 1; vc < rowArr.length; vc++) {
            const vv = rowArr[vc];
            if (typeof vv === "number" && vv > 0) vals.push(vv);
          }
          if (vals.length >= 2) {
            const rowText = rowArr.map((v) => String(v ?? "").toLowerCase()).join(" ");
            const isMetres = rowText.includes("m(w)") || (rowText.includes("(w)") && !rowText.includes("mm(w)"));
            screenSize = isMetres ? `${vals[0]}m x ${vals[1]}m` : `${vals[0]}mm x ${vals[1]}mm`;
          }
        }
      }
    }
  }

  // ── Parse structured screen info from raw text fields ────────────────────
  const screenInfo: ParsedScreenInfo = {
    screenWidthMm: null, screenHeightMm: null,
    pixelPitchMm: null,
    cabinetWidthMm: null, cabinetHeightMm: null,
    panelCountW: null, panelCountH: null,
    resolutionW: null, resolutionH: null,
    brightnessNits: null, cabinetWeightKg: null,
  };

  // Screen size: "4.8m x 2.4m" or "4800mm x 2400mm" or "4800 x 2400"
  if (screenSize) {
    const sizeMatch = screenSize.match(/([\d.]+)\s*(m|mm)?\s*[x×]\s*([\d.]+)\s*(m|mm)?/i);
    if (sizeMatch) {
      const w = parseFloat(sizeMatch[1]);
      const wUnit = (sizeMatch[2] || sizeMatch[4] || "").toLowerCase();
      const h = parseFloat(sizeMatch[3]);
      const hUnit = (sizeMatch[4] || sizeMatch[2] || "").toLowerCase();
      screenInfo.screenWidthMm = wUnit === "m" ? w * 1000 : (wUnit === "mm" || w > 100) ? w : w * 1000;
      screenInfo.screenHeightMm = hUnit === "m" ? h * 1000 : (hUnit === "mm" || h > 100) ? h : h * 1000;
    }
  }

  // Panel config: "10W x 5H" or "10 x 5"
  if (panelConfig) {
    const panelMatch = panelConfig.match(/(\d+)\s*W?\s*[x×]\s*(\d+)\s*H?/i);
    if (panelMatch) {
      screenInfo.panelCountW = parseInt(panelMatch[1]);
      screenInfo.panelCountH = parseInt(panelMatch[2]);
    }
  }

  // Resolution: "3840 x 1920"
  if (totalResolution) {
    const resMatch = totalResolution.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (resMatch) {
      screenInfo.resolutionW = parseInt(resMatch[1]);
      screenInfo.resolutionH = parseInt(resMatch[2]);
    }
  }

  // Pixel pitch: "2.5mm" or "2.5"
  if (pixelPitchRaw) {
    const pitchMatch = pixelPitchRaw.match(/([\d.]+)/);
    if (pitchMatch) screenInfo.pixelPitchMm = parseFloat(pitchMatch[1]);
  }

  // Brightness: "5000 nits" or "5000"
  if (brightnessRaw) {
    const brightMatch = brightnessRaw.match(/([\d,]+)/);
    if (brightMatch) screenInfo.brightnessNits = parseInt(brightMatch[1].replace(/,/g, ""));
  }

  // Cabinet size: "500mm x 500mm" or "500 x 500" or "600mm(W) x 337.5mm(H)*45mm(T)"
  if (cabinetSizeRaw) {
    const cabMatch = cabinetSizeRaw.match(/([\d.]+)\s*mm?\s*(?:\(W\))?\s*[x×*]\s*([\d.]+)\s*mm?\s*(?:\(H\))?/i);
    if (cabMatch) {
      screenInfo.cabinetWidthMm = parseFloat(cabMatch[1]);
      screenInfo.cabinetHeightMm = parseFloat(cabMatch[2]);
    }
  }

  // Cabinet weight: "8.5kg" or "8.5"
  if (cabinetWeightRaw) {
    const weightMatch = cabinetWeightRaw.match(/([\d.]+)/);
    if (weightMatch) screenInfo.cabinetWeightKg = parseFloat(weightMatch[1]);
  }

  // ── Parse line items ───────────────────────────────────────────────────────
  // Start after header — check if the row right after header has data (qty/price),
  // if so start there; otherwise skip one sub-header row
  let dataStart: number;
  if (headerRowIdx >= 0) {
    const nextRow = headerRowIdx + 1;
    const nextQty = cellNum(nextRow, colQty);
    const nextPrice = cellNum(nextRow, colUnitPrice);
    dataStart = (nextQty > 0 || nextPrice > 0) ? nextRow : headerRowIdx + 2;
  } else {
    dataStart = 17;
  }
  const lineItems: ParsedLineItem[] = [];
  let sortOrder = 0;
  let lastCategory = "";
  let xlsTotalUsd = 0;

  for (let rowIdx = dataStart; rowIdx < raw.length; rowIdx++) {
    const c0 = cell(rowIdx, 0);
    const c0l = c0.toLowerCase();

    // Detect the total row — stop parsing items
    if (c0l.startsWith("total amount") || c0l.startsWith("total:") || c0l === "total") {
      // Total value is in the last populated numeric cell of this row
      // Try the sub-total column first, then scan right-to-left
      xlsTotalUsd = cellNum(rowIdx, colSubTotal);
      if (!xlsTotalUsd) {
        const r = raw[rowIdx] as unknown[];
        for (let c = (r?.length ?? 0) - 1; c >= 0; c--) {
          const v = cellNum(rowIdx, c);
          if (v > 0) { xlsTotalUsd = v; break; }
        }
      }
      break;
    }

    // Track the last non-empty category (handles merged cells)
    if (c0) lastCategory = c0;

    const qty = cellNum(rowIdx, colQty);
    const usdUnitPrice = cellNum(rowIdx, colUnitPrice);

    // Skip rows with no quantity AND no price
    if (!qty && !usdUnitPrice) continue;

    // Build item name
    // For merged-cell formats the description sits in colDesc when col 0 is empty
    const subDesc = cell(rowIdx, colDesc);
    let itemName: string;
    if (c0) {
      // Col 0 has a value — use it, appending sub-description if it adds information
      itemName = subDesc && subDesc !== "/" && subDesc.toLowerCase() !== c0.toLowerCase()
        ? `${c0} – ${subDesc}`
        : c0;
    } else {
      // Merged cell: carry-forward category + sub-description
      itemName = subDesc && subDesc !== "/"
        ? `${lastCategory} – ${subDesc}`
        : lastCategory;
    }

    const description = subDesc !== "/" ? subDesc : cell(rowIdx, colDesc + 1);
    const unit = cell(rowIdx, colUnit) || "PCS";
    const isFree = usdUnitPrice === 0;

    lineItems.push({ itemName, description, unit, qty, usdUnitPrice, isFree, sortOrder: sortOrder++ });
  }

  const totalUsd = lineItems.reduce((sum, item) => {
    if (item.isFree) return sum;
    return sum + item.qty * item.usdUnitPrice;
  }, 0);

  // ── Extract brightness from remarks column if not found in metadata ──
  // Leyard quotes often put brightness info like "600-800 nits" in the remarks of the first LED panel item
  if (!screenInfo.brightnessNits && colRemarks >= 0) {
    for (let rowIdx = dataStart; rowIdx < raw.length && rowIdx < dataStart + 5; rowIdx++) {
      const remark = cell(rowIdx, colRemarks);
      const nitsMatch = remark.match(/(\d[\d,-]*)\s*nits/i);
      if (nitsMatch) {
        // Handle ranges like "600-800" — take the higher value
        const parts = nitsMatch[1].split(/[-–]/);
        const vals = parts.map((p) => parseInt(p.replace(/,/g, ""))).filter((n) => !isNaN(n));
        if (vals.length > 0) {
          screenInfo.brightnessNits = Math.max(...vals);
          break;
        }
      }
    }
  }

  return {
    sheetName,
    name,
    supplierQuoteRef,
    supplierQuoteDate,
    screenSize,
    panelConfig,
    totalResolution,
    screenInfo,
    lineItems,
    totalUsd,
    xlsTotalUsd,
  };
}

function parseWorkbook(file: File): Promise<ParsedQuote[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const quotes = wb.SheetNames.map((name) => parseSheet(wb.Sheets[name], name));
        resolve(quotes);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Upload", "Context", "Settings", "Confirm"];
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const num = i + 1;
        const isActive = num === current;
        const isDone = num < current;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-[#DB412B] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isDone ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 ${isActive ? "text-[#DB412B] font-medium" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-16 mx-1 mb-4 ${isDone ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 state
  const [parsedQuotes, setParsedQuotes] = useState<ParsedQuote[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2 state
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [clientsLoaded, setClientsLoaded] = useState(false);

  const [projectMode, setProjectMode] = useState<"existing" | "new">("existing");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  const [quoteAction, setQuoteAction] = useState<"new" | "update">("new");
  const [existingQuotes, setExistingQuotes] = useState<ExistingQuote[]>([]);
  const [selectedExistingQuoteId, setSelectedExistingQuoteId] = useState<number | null>(null);

  // Step 3 state
  const [fxRate, setFxRate] = useState("0.625");
  const [defaultMargin, setDefaultMargin] = useState("50");
  const [defaultResellerMargin, setDefaultResellerMargin] = useState("30");
  const [validUntil, setValidUntil] = useState("");
  const [quoteNames, setQuoteNames] = useState<string[]>([]);

  // Step 4 state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // ── File handling ──

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    try {
      const quotes = await parseWorkbook(file);
      if (quotes.length === 0) {
        setParseError("No sheets found in the file.");
        return;
      }
      setParsedQuotes(quotes);
      setQuoteNames(quotes.map((q) => q.name));
    } catch {
      setParseError("Failed to parse file. Make sure it is a valid .xls or .xlsx file.");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── Step 2 data loading ──

  const loadClients = useCallback(async () => {
    if (clientsLoaded) return;
    const res = await fetch("/api/clients");
    const data = await res.json();
    setClients(data);
    setClientsLoaded(true);
  }, [clientsLoaded]);

  const loadProjects = useCallback(async (cId: number) => {
    const res = await fetch(`/api/projects?clientId=${cId}`);
    const data = await res.json();
    setProjects(data);
    setSelectedProjectId(null);
    setExistingQuotes([]);
  }, []);

  const loadExistingQuotes = useCallback(async (pId: number) => {
    const res = await fetch(`/api/quotes?projectId=${pId}`);
    const data = await res.json();
    setExistingQuotes(data);
  }, []);

  // ── Step transitions ──

  const goToStep2 = () => {
    loadClients();
    setStep(2);
  };

  const goToStep3 = () => {
    setStep(3);
  };

  const goToStep4 = () => {
    setStep(4);
  };

  // ── Import ──

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);

    const resolvedClientId = clientMode === "existing" ? selectedClientId : null;
    const resolvedProjectId = projectMode === "existing" ? selectedProjectId : null;
    const resolvedExistingQuoteId =
      quoteAction === "update" && selectedExistingQuoteId ? selectedExistingQuoteId : undefined;

    const payload = {
      clientId: resolvedClientId,
      clientName: clientMode === "new" ? newClientName.trim() : undefined,
      projectId: resolvedProjectId,
      projectName: projectMode === "new" ? newProjectName.trim() : undefined,
      quoteAction,
      existingQuoteId: resolvedExistingQuoteId,
      fxRate: parseFloat(fxRate),
      defaultMargin: parseFloat(defaultMargin) / 100,
      defaultResellerMargin: parseFloat(defaultResellerMargin) / 100,
      validUntil: validUntil || undefined,
      quotes: parsedQuotes.map((q, i) => ({
        name: quoteNames[i] ?? q.name,
        supplierQuoteRef: q.supplierQuoteRef,
        supplierQuoteDate: q.supplierQuoteDate,
        screenSize: q.screenSize,
        panelConfig: q.panelConfig,
        totalResolution: q.totalResolution,
        ...q.screenInfo,
        lineItems: q.lineItems,
      })),
    };

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: { success?: boolean; error?: string; quoteIds?: number[] } = {};
      try {
        data = await res.json();
      } catch {
        setImportError(`Server error (${res.status} ${res.statusText})`);
        setImporting(false);
        return;
      }
      if (!res.ok || !data.success) {
        setImportError(data.error ?? `Import failed (${res.status})`);
        setImporting(false);
        return;
      }
      // Redirect to first quote
      router.push(`/quotes/${data.quoteIds![0]}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error during import");
      setImporting(false);
    }
  };

  // ── Validation helpers ──

  const clientReady =
    clientMode === "existing" ? !!selectedClientId : !!newClientName.trim();
  const projectReady =
    projectMode === "existing" ? !!selectedProjectId : !!newProjectName.trim();
  const quoteReady =
    quoteAction === "new" || parsedQuotes.length !== 1
      ? true
      : !!selectedExistingQuoteId;

  const step2Ready = clientReady && projectReady && quoteReady;

  const fmtUsd = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <StepIndicator current={step} />

      {/* ── STEP 1: Upload ── */}
      {step === 1 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-archivo text-lg font-semibold text-gray-900 mb-4">Upload Leyard Quote File</h2>

          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-[#DB412B] bg-red-50"
                : "border-gray-300 bg-[#0D1B2A]/5 hover:border-[#DB412B] hover:bg-red-50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-5xl mb-3 text-gray-300">📄</div>
            <p className="text-gray-600 font-medium mb-1">Drag & drop your .xls or .xlsx file here</p>
            <p className="text-sm text-gray-400">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {parseError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {parseError}
            </div>
          )}

          {parsedQuotes.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Found {parsedQuotes.length} sheet{parsedQuotes.length > 1 ? "s" : ""}:
              </p>
              {parsedQuotes.map((q, i) => (
                <div key={i} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{q.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Sheet: {q.sheetName}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-gray-900">{fmtUsd(q.totalUsd)} USD</p>
                      <p className="text-xs text-gray-500">{q.lineItems.length} line items</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                    {q.screenSize && <p>Screen: {q.screenSize}</p>}
                    {q.panelConfig && <p>Panels: {q.panelConfig}</p>}
                    {q.supplierQuoteDate && <p>Date: {q.supplierQuoteDate}</p>}
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <button
                  onClick={goToStep2}
                  className="px-6 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-medium"
                >
                  Looks good, continue →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Context ── */}
      {step === 2 && (
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <h2 className="font-archivo text-lg font-semibold text-gray-900">Set Context</h2>

          {/* Client */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Client</p>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === "existing"}
                  onChange={() => setClientMode("existing")}
                  className="accent-[#DB412B]"
                />
                Existing client
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === "new"}
                  onChange={() => setClientMode("new")}
                  className="accent-[#DB412B]"
                />
                New client
              </label>
            </div>
            {clientMode === "existing" ? (
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={selectedClientId ?? ""}
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  setSelectedClientId(id);
                  setSelectedProjectId(null);
                  setExistingQuotes([]);
                  loadProjects(id);
                }}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Client name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            )}
          </div>

          {/* Project (only once client is chosen) */}
          {clientReady && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Project</p>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={projectMode === "existing"}
                    onChange={() => setProjectMode("existing")}
                    className="accent-[#DB412B]"
                  />
                  Existing project
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={projectMode === "new"}
                    onChange={() => setProjectMode("new")}
                    className="accent-[#DB412B]"
                  />
                  New project
                </label>
              </div>
              {projectMode === "existing" ? (
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedProjectId ?? ""}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    setSelectedProjectId(id);
                    setExistingQuotes([]);
                    loadExistingQuotes(id);
                  }}
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Quote action (only once project is chosen) */}
          {clientReady && projectReady && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Quote Action</p>
              {parsedQuotes.length > 1 ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  {parsedQuotes.length} options will be imported as separate quotes
                </div>
              ) : existingQuotes.length > 0 ? (
                <>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={quoteAction === "new"}
                        onChange={() => setQuoteAction("new")}
                        className="accent-[#DB412B]"
                      />
                      Add as new quote
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        checked={quoteAction === "update"}
                        onChange={() => setQuoteAction("update")}
                        className="accent-[#DB412B]"
                      />
                      Update existing quote
                    </label>
                  </div>
                  {quoteAction === "update" && (
                    <>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm mb-2"
                        value={selectedExistingQuoteId ?? ""}
                        onChange={(e) => setSelectedExistingQuoteId(parseInt(e.target.value))}
                      >
                        <option value="">Select a quote to update…</option>
                        {existingQuotes.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.quoteNumber} — {q.name}
                          </option>
                        ))}
                      </select>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                        Warning: This will replace all line items in the selected quote.
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                  A new quote will be created
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2 bg-[#0D1B2A] text-white rounded-lg hover:bg-[#1a2e44] transition-colors text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={goToStep3}
              disabled={!step2Ready}
              className="px-6 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Settings ── */}
      {step === 3 && (
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <h2 className="font-archivo text-lg font-semibold text-gray-900">Quote Settings</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">FX Rate (USD → AUD)</label>
              <input
                type="number"
                step="0.001"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">LUX Margin %</label>
              <input
                type="number"
                step="1"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={defaultMargin}
                onChange={(e) => setDefaultMargin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reseller Margin %</label>
              <input
                type="number"
                step="1"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={defaultResellerMargin}
                onChange={(e) => setDefaultResellerMargin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until (optional)</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Quote Names</p>
            <div className="space-y-2">
              {parsedQuotes.map((q, i) => (
                <div key={i}>
                  {parsedQuotes.length > 1 && (
                    <label className="block text-xs text-gray-500 mb-1">
                      Sheet: {q.sheetName}
                    </label>
                  )}
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={quoteNames[i] ?? q.name}
                    onChange={(e) => {
                      const updated = [...quoteNames];
                      updated[i] = e.target.value;
                      setQuoteNames(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2 bg-[#0D1B2A] text-white rounded-lg hover:bg-[#1a2e44] transition-colors text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={goToStep4}
              className="px-6 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-medium"
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Confirm ── */}
      {step === 4 && (
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <h2 className="font-archivo text-lg font-semibold text-gray-900">Confirm & Import</h2>

          <div className="rounded-lg border bg-gray-50 p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-gray-500">Client:</span>{" "}
                <span className="font-medium text-gray-900">
                  {clientMode === "new"
                    ? `${newClientName} (new)`
                    : clients.find((c) => c.id === selectedClientId)?.name ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Project:</span>{" "}
                <span className="font-medium text-gray-900">
                  {projectMode === "new"
                    ? `${newProjectName} (new)`
                    : projects.find((p) => p.id === selectedProjectId)?.name ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Action:</span>{" "}
                <span className="font-medium text-gray-900">
                  {quoteAction === "update"
                    ? `Update quote ${existingQuotes.find((q) => q.id === selectedExistingQuoteId)?.quoteNumber ?? ""}`
                    : parsedQuotes.length > 1
                    ? `Create ${parsedQuotes.length} new quotes`
                    : "Create 1 new quote"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">FX Rate:</span>{" "}
                <span className="font-medium text-gray-900">{fxRate}</span>
              </div>
              <div>
                <span className="text-gray-500">LUX Margin:</span>{" "}
                <span className="font-medium text-gray-900">{defaultMargin}%</span>
              </div>
              <div>
                <span className="text-gray-500">Reseller Margin:</span>{" "}
                <span className="font-medium text-gray-900">{defaultResellerMargin}%</span>
              </div>
            </div>

            <hr className="border-gray-200" />

            {parsedQuotes.map((q, i) => {
              const mismatch = q.xlsTotalUsd > 0 && Math.abs(q.totalUsd - q.xlsTotalUsd) > 0.5;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{quoteNames[i] ?? q.name}</p>
                      <p className="text-xs text-gray-500">{q.lineItems.length} line items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{fmtUsd(q.totalUsd)} USD</p>
                      {mismatch && (
                        <p className="text-xs text-amber-600">XLS total: {fmtUsd(q.xlsTotalUsd)}</p>
                      )}
                    </div>
                  </div>
                  {mismatch && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                      ⚠ Parsed total doesn&apos;t match the XLS total — some line items may have been missed. Check the spreadsheet for merged or grouped rows.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {importError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(3)}
              disabled={importing}
              className="px-5 py-2 bg-[#0D1B2A] text-white rounded-lg hover:bg-[#1a2e44] transition-colors text-sm font-medium disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-8 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing…
                </>
              ) : (
                "Import Quote"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

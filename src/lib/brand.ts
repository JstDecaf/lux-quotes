export const brand = {
  colors: {
    signalRed: "#DB412B",
    deepBlack: "#0D1B2A",
    white: "#FFFFFF",
    status: {
      draft: "#9CA3AF",
      sent: "#3B82F6",
      won: "#22C55E",
      lost: "#EF4444",
      expired: "#F59E0B",
      converted: "#8B5CF6",
    },
  },
  fonts: {
    heading: "Archivo",
    body: "Inter",
  },
} as const;

export type QuoteStatus = "draft" | "sent" | "won" | "lost" | "expired" | "converted_to_pi";

export const statusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
  expired: "Expired",
  converted_to_pi: "Converted to PI",
};

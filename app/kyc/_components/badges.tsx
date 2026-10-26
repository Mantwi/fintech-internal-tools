import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { humanize } from "@/lib/format";

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: "neutral",
  IN_REVIEW: "info",
  ESCALATED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const RISK_TONES: Record<string, BadgeTone> = { LOW: "success", MEDIUM: "warning", HIGH: "danger" };

export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONES[status]}>{humanize(status)}</Badge>;
export const RiskBadge = ({ risk }: { risk: string }) => <Badge tone={RISK_TONES[risk]}>{humanize(risk)}</Badge>;

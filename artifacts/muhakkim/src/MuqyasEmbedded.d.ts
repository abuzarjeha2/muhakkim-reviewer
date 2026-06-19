import type { ComponentType } from "react";

interface MuqyasEmbeddedProps {
  embed?: boolean;
  initialTool?: string | null;
  dark?: boolean;
}

declare const MuqyasEmbedded: ComponentType<MuqyasEmbeddedProps>;
export default MuqyasEmbedded;

interface MuqyasTool {
  key: string;
  icon: string;
  ar: string;
  en: string;
  badge?: string;
  sec?: string;
}
interface MuqyasGroup {
  id: string;
  icon: string;
  ar: string;
  color?: string;
  desc?: string;
  tools: MuqyasTool[];
}
export declare const MUQYAS_GROUPS: MuqyasGroup[];

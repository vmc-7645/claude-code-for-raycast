import { getPreferenceValues } from "@raycast/api";

export interface Prefs {
  editorCommand?: string;
  reposRoot?: string;
  primaryClick?: "focus" | "resume";
}

export function prefs(): Prefs {
  return getPreferenceValues<Prefs>();
}

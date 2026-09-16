export const ESTADOS_CHECKLIST_VALIDOS = ["conforme", "no_conforme"] as const;

export type EstadoChecklist = (typeof ESTADOS_CHECKLIST_VALIDOS)[number];

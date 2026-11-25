export type SubjectKey =
  | "maths"
  | "eco"
  | "droit"
  | "management"
  | "anglais"
  | "espagnol"
  | "lettres"
  | "philo";

export interface SubjectDef {
  key: SubjectKey;
  name: string;
  teacher: string;
  googleColorId: string;
  color: string;
}

/** Matières par défaut (section 4 de la spec), dans l'ordre d'affichage. */
export const DEFAULT_SUBJECTS: SubjectDef[] = [
  { key: "maths", name: "Mathématiques", teacher: "Le Mintier", googleColorId: "11", color: "#D50000" },
  { key: "eco", name: "Économie", teacher: "Jacquier", googleColorId: "5", color: "#F6BF26" },
  { key: "droit", name: "Droit", teacher: "Huguet", googleColorId: "9", color: "#3F51B5" },
  { key: "management", name: "Management", teacher: "Jacques", googleColorId: "3", color: "#B0369B" },
  { key: "anglais", name: "Anglais", teacher: "Defrance", googleColorId: "7", color: "#039BE5" },
  { key: "espagnol", name: "Espagnol", teacher: "Mayoral", googleColorId: "6", color: "#F4511E" },
  { key: "lettres", name: "Lettres", teacher: "Gay", googleColorId: "10", color: "#33B679" },
  { key: "philo", name: "Philosophie", teacher: "Cervellon", googleColorId: "10", color: "#00897B" },
];

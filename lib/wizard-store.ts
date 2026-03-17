import { create } from "zustand";

export type Lang = "es" | "en" | "pt";
export type ServiceType = "register_company" | "fda_fsma" | "market_entry" | "not_sure";
export type ExportVolume = "not_exporting" | "starting_under_100k" | "exporting_100k_1m" | "high_volume_over_1m";
export type Platform = "meet" | "zoom" | "whatsapp";

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  serviceType?: ServiceType;
  exportVolume?: ExportVolume;
  isB2b?: boolean;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientWhatsapp: string;
  clientCountryCode: string;
  selectedSlot?: string;
  platform?: Platform;
  language: Lang;
  repSlug?: string;
  utmSource?: string;
  personalEmailWarning: boolean;
}

interface WizardStore extends WizardState {
  setStep: (s: WizardState["step"]) => void;
  setServiceType: (v: ServiceType) => void;
  setExportVolume: (v: ExportVolume) => void;
  setIsB2b: (v: boolean) => void;
  setClientName: (v: string) => void;
  setClientEmail: (v: string) => void;
  setClientCompany: (v: string) => void;
  setClientWhatsapp: (v: string) => void;
  setClientCountryCode: (v: string) => void;
  setSelectedSlot: (v: string) => void;
  setPlatform: (v: Platform) => void;
  setLanguage: (v: Lang) => void;
  setRepSlug: (v: string | undefined) => void;
  setUtmSource: (v: string | undefined) => void;
  setPersonalEmailWarning: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

const initial: WizardState = {
  step: 1,
  clientName: "",
  clientEmail: "",
  clientCompany: "",
  clientWhatsapp: "",
  clientCountryCode: "+54",
  language: "es",
  personalEmailWarning: false,
};

export const useWizard = create<WizardStore>((set, get) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setServiceType: (serviceType) => set({ serviceType }),
  setExportVolume: (exportVolume) => set({ exportVolume }),
  setIsB2b: (isB2b) => set({ isB2b }),
  setClientName: (clientName) => set({ clientName }),
  setClientEmail: (clientEmail) => set({ clientEmail }),
  setClientCompany: (clientCompany) => set({ clientCompany }),
  setClientWhatsapp: (clientWhatsapp) => set({ clientWhatsapp }),
  setClientCountryCode: (clientCountryCode) => set({ clientCountryCode }),
  setSelectedSlot: (selectedSlot) => set({ selectedSlot }),
  setPlatform: (platform) => set({ platform }),
  setLanguage: (language) => set({ language }),
  setRepSlug: (repSlug) => set({ repSlug }),
  setUtmSource: (utmSource) => set({ utmSource }),
  setPersonalEmailWarning: (personalEmailWarning) => set({ personalEmailWarning }),
  next: () => { const s = get().step; if (s < 5) set({ step: (s + 1) as WizardState["step"] }); },
  prev: () => { const s = get().step; if (s > 1) set({ step: (s - 1) as WizardState["step"] }); },
  reset: () => set(initial),
}));

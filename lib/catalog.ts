export interface Service {
  category: string;
  name: string;
  price: number;
  description: string;
}

export const CATALOG_ES: Service[] = [
  { category: "Alimentos y Bebidas", name: "Registro Establecimiento FDA", price: 595, description: "Registro oficial ante la FDA. Obligatorio para exportar alimentos a EE.UU. Incluye DUNS sin cargo." },
  { category: "Alimentos y Bebidas", name: "Registro Estab. enlatados / bajos en ácidos / acidificados", price: 950, description: "Registro especializado para productos enlatados, bajos en ácidos y acidificados." },
  { category: "Alimentos y Bebidas", name: "Renovación anual establecimiento FDA", price: 499, description: "Renovación anual obligatoria del registro FDA de su establecimiento." },
  { category: "Alimentos y Bebidas", name: "Renovación FDA 2 años", price: 899, description: "Renovación del registro FDA de su establecimiento por 2 años. Ahorro frente a la renovación anual." },
  { category: "Alimentos y Bebidas", name: "Renovación FDA 3 años", price: 1349, description: "Renovación del registro FDA de su establecimiento por 3 años. Máximo ahorro y sin preocupaciones por vencimientos." },
  { category: "Alimentos y Bebidas", name: "Registro por producto enlatados / bajos en ácidos / acidificados", price: 195, description: "Registro individual por producto para líneas enlatadas y acidificadas." },
  { category: "Alimentos y Bebidas", name: "Revisión de etiquetas (1ra etiqueta)", price: 595, description: "Revisión y aprobación de etiqueta conforme lineamientos FDA." },
  { category: "Alimentos y Bebidas", name: "Revisión de etiquetas (etiquetas adicionales)", price: 185, description: "Revisión de cada etiqueta adicional luego de la primera." },
  { category: "Alimentos y Bebidas", name: "FSVP", price: 395, description: "Foreign Supplier Verification Program. Requerido para importadores de alimentos en EE.UU." },
  { category: "Bebidas Alcohólicas", name: "Licencia en Florida para vino y cerveza", price: 6000, description: "Licencia en Florida para importación y distribución de vinos y cervezas." },
  { category: "Bebidas Alcohólicas", name: "Licencia en Florida para otras bebidas alcohólicas", price: 7500, description: "Licencia para importación y distribución de bebidas alcohólicas destiladas en Florida." },
  { category: "USDA", name: "Registro en USDA Frutas y verduras", price: 1500, description: "Registro USDA para exportación de frutas y verduras frescas." },
  { category: "USDA", name: "Registro en USDA VS Permit", price: 1500, description: "Permiso veterinario USDA para productos de origen animal." },
  { category: "Cosméticos", name: "Registro Establecimiento FDA (Cosméticos)", price: 595, description: "Registro FDA para establecimientos productores de cosméticos." },
  { category: "Cosméticos", name: "Registro por producto (Cosméticos)", price: 195, description: "Registro individual de producto cosmético ante la FDA." },
  { category: "Cosméticos", name: "Revisión de etiquetas (1ra etiqueta) — Cosméticos", price: 595, description: "Revisión del primer rótulo para cosméticos conforme FDA." },
  { category: "Cosméticos", name: "Revisión de etiquetas (etiquetas adicionales) — Cosméticos", price: 185, description: "Revisión de rótulo adicional para cosméticos." },
  { category: "Medicamentos", name: "Registro Establecimiento FDA (Medicamentos)", price: 595, description: "Registro FDA para establecimientos de medicamentos." },
  { category: "Medicamentos", name: "Registro por producto (Medicamentos)", price: 195, description: "Registro individual de producto medicinal ante la FDA." },
  { category: "Medicamentos", name: "Revisión de etiquetas (1ra etiqueta) — Medicamentos", price: 595, description: "Revisión del primer rótulo para medicamentos conforme FDA." },
  { category: "Medicamentos", name: "Revisión de etiquetas (etiquetas adicionales) — Medicamentos", price: 185, description: "Revisión de rótulo adicional para medicamentos." },
  { category: "Medical Devices", name: "Registro Establecimiento FDA (Medical Devices)", price: 595, description: "Registro FDA para fabricantes y distribuidores de dispositivos médicos." },
  { category: "Medical Devices", name: "Registro por producto (Medical Device)", price: 195, description: "Registro individual de cada dispositivo médico ante la FDA." },
  { category: "Medical Devices", name: "Revisión de etiquetas (1ra etiqueta) — Medical Devices", price: 595, description: "Revisión del primer rótulo para devices conforme FDA." },
  { category: "Medical Devices", name: "Revisión de etiquetas (etiquetas adicionales) — Medical Devices", price: 185, description: "Revisión de rótulo adicional para medical devices." },
  { category: "Apertura de Empresa", name: "Registro de Empresa LLC en Miami", price: 1100, description: "Constitución completa de LLC en Miami, Florida." },
  { category: "Apertura de Empresa", name: "Operating Agreement", price: 450, description: "Redacción del acuerdo operacional para su LLC." },
  { category: "NOAA & US Fisheries", name: "NOAA Fisheries", price: 1500, description: "Registro ante NOAA para productos pesqueros de exportación a EE.UU." },
  { category: "NOAA & US Fisheries", name: "USFWS (US Fish & Wildlife Service)", price: 950, description: "Permiso US Fish & Wildlife Service para productos de fauna silvestre." },
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Paquete Básico (LLC mandatory)", price: 2000, description: "Registro de marca en USPTO — Paquete Básico. Requiere LLC." },
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Paquete Premium (LLC mandatory)", price: 3000, description: "Registro de marca USPTO con cobertura amplia. Requiere LLC." },
  { category: "Cursos", name: "Buenas Prácticas de Manufactura (BPM)", price: 299, description: "Alimentos, Suplementos dietarios, Cosméticos y Medicamentos." },
  { category: "Otros", name: "US Agent Inbox (Monthly Fee)", price: 99, description: "Servicio mensual de US Agent Inbox para notificaciones FDA." },
];

export const CATALOG_EN: Service[] = [
  { category: "Food & Beverage", name: "FDA Establishment Registration", price: 595, description: "Official registration with the FDA. Mandatory to export food to the US. Includes DUNS number at no cost." },
  { category: "Food & Beverage", name: "Canned / Low-Acid / Acidified Establishment Registration", price: 950, description: "Specialized registration for canned, low-acid and acidified products." },
  { category: "Food & Beverage", name: "FDA Establishment Annual Renewal", price: 499, description: "Mandatory annual renewal of your FDA establishment registration." },
  { category: "Food & Beverage", name: "FDA Renewal - 2 years", price: 899, description: "FDA establishment registration renewal for 2 years. Savings compared to annual renewal." },
  { category: "Food & Beverage", name: "FDA Renewal - 3 years", price: 1349, description: "FDA establishment registration renewal for 3 years. Maximum savings, no expiration worries." },
  { category: "Food & Beverage", name: "Product Registration — Canned / Low-Acid / Acidified", price: 195, description: "Individual product registration for canned and acidified product lines." },
  { category: "Food & Beverage", name: "Label Review (1st label)", price: 595, description: "Label review and approval per FDA guidelines." },
  { category: "Food & Beverage", name: "Label Review (additional labels)", price: 185, description: "Review of each additional label after the first." },
  { category: "Food & Beverage", name: "FSVP", price: 395, description: "Foreign Supplier Verification Program. Required for food importers in the US." },
  { category: "Alcoholic Beverages", name: "Florida License for Wine & Beer", price: 6000, description: "Florida license for importation and distribution of wines and beers." },
  { category: "Alcoholic Beverages", name: "Florida License for Other Alcoholic Beverages", price: 7500, description: "License for importation and distribution of distilled spirits in Florida." },
  { category: "USDA", name: "USDA Registration — Fruits & Vegetables", price: 1500, description: "USDA registration for fresh fruit and vegetable exports." },
  { category: "USDA", name: "USDA VS Permit", price: 1500, description: "USDA veterinary permit for animal-origin products." },
  { category: "Cosmetics", name: "FDA Establishment Registration (Cosmetics)", price: 595, description: "FDA registration for cosmetic manufacturing establishments." },
  { category: "Cosmetics", name: "Product Registration (Cosmetics)", price: 195, description: "Individual FDA registration per cosmetic product." },
  { category: "Cosmetics", name: "Label Review (1st label) — Cosmetics", price: 595, description: "First cosmetics label review per FDA guidelines." },
  { category: "Cosmetics", name: "Label Review (additional labels) — Cosmetics", price: 185, description: "Additional label review for cosmetics." },
  { category: "Pharmaceuticals", name: "FDA Establishment Registration (Pharmaceuticals)", price: 595, description: "FDA registration for pharmaceutical establishments." },
  { category: "Pharmaceuticals", name: "Product Registration (Pharmaceuticals)", price: 195, description: "Individual FDA registration per drug or supplement." },
  { category: "Pharmaceuticals", name: "Label Review (1st label) — Pharmaceuticals", price: 595, description: "First pharmaceutical label review per FDA guidelines." },
  { category: "Pharmaceuticals", name: "Label Review (additional labels) — Pharmaceuticals", price: 185, description: "Additional label review for pharmaceuticals." },
  { category: "Medical Devices", name: "FDA Establishment Registration (Medical Devices)", price: 595, description: "FDA registration for medical device manufacturers and distributors." },
  { category: "Medical Devices", name: "Product Registration (Medical Device)", price: 195, description: "Individual FDA registration per medical device." },
  { category: "Medical Devices", name: "Label Review (1st label) — Medical Devices", price: 595, description: "First medical device label review per FDA guidelines." },
  { category: "Medical Devices", name: "Label Review (additional labels) — Medical Devices", price: 185, description: "Additional label review for medical devices." },
  { category: "Company Formation", name: "LLC Company Registration in Miami", price: 1100, description: "Complete LLC formation in Miami, Florida." },
  { category: "Company Formation", name: "Operating Agreement", price: 450, description: "Drafting of the Operating Agreement for your LLC." },
  { category: "NOAA & US Fisheries", name: "NOAA Fisheries", price: 1500, description: "NOAA registration for seafood products exported to the US." },
  { category: "NOAA & US Fisheries", name: "USFWS (US Fish & Wildlife Service)", price: 950, description: "US Fish & Wildlife Service permit for wildlife products." },
  { category: "USPTO Trademark", name: "Trademark Registration — Basic Package (LLC mandatory)", price: 2000, description: "USPTO trademark registration — Basic package. LLC required." },
  { category: "USPTO Trademark", name: "Trademark Registration — Premium Package (LLC mandatory)", price: 3000, description: "USPTO trademark registration with extended coverage. LLC required." },
  { category: "Courses", name: "Good Manufacturing Practices (GMP)", price: 299, description: "Food, dietary supplements, cosmetics and pharmaceuticals." },
  { category: "Other", name: "US Agent Inbox (Monthly Fee)", price: 99, description: "Monthly US Agent Inbox service for FDA notifications." },
];

export const CATALOG_PT: Service[] = [
  { category: "Alimentos e Bebidas", name: "Registro de Estabelecimento FDA", price: 595, description: "Registro oficial na FDA. Obrigatório para exportar alimentos aos EUA. Inclui DUNS sem custo." },
  { category: "Alimentos e Bebidas", name: "Registro Estab. enlatados / baixa acidez / acidificados", price: 950, description: "Registro especializado para produtos enlatados, de baixa acidez e acidificados." },
  { category: "Alimentos e Bebidas", name: "Renovação anual do estabelecimento FDA", price: 499, description: "Renovação anual obrigatória do registro FDA do seu estabelecimento." },
  { category: "Alimentos e Bebidas", name: "Renovação FDA 2 anos", price: 899, description: "Renovação do registro FDA do seu estabelecimento por 2 anos. Economia em relação à renovação anual." },
  { category: "Alimentos e Bebidas", name: "Renovação FDA 3 anos", price: 1349, description: "Renovação do registro FDA do seu estabelecimento por 3 anos. Máxima economia e sem preocupações com vencimentos." },
  { category: "Alimentos e Bebidas", name: "Registro por produto enlatados / baixa acidez / acidificados", price: 195, description: "Registro individual por produto para linhas enlatadas e acidificadas." },
  { category: "Alimentos e Bebidas", name: "Revisão de rótulos (1º rótulo)", price: 595, description: "Revisão e aprovação de rótulo conforme diretrizes da FDA." },
  { category: "Alimentos e Bebidas", name: "Revisão de rótulos (rótulos adicionais)", price: 185, description: "Revisão de cada rótulo adicional após o primeiro." },
  { category: "Alimentos e Bebidas", name: "FSVP", price: 395, description: "Foreign Supplier Verification Program. Obrigatório para importadores de alimentos nos EUA." },
  { category: "Bebidas Alcoólicas", name: "Licença na Flórida para vinho e cerveja", price: 6000, description: "Licença na Flórida para importação e distribuição de vinhos e cervejas." },
  { category: "Bebidas Alcoólicas", name: "Licença na Flórida para outras bebidas alcoólicas", price: 7500, description: "Licença para importação e distribuição de bebidas destiladas na Flórida." },
  { category: "USDA", name: "Registro no USDA Frutas e legumes", price: 1500, description: "Registro no USDA para exportação de frutas e legumes frescos." },
  { category: "USDA", name: "Registro no USDA VS Permit", price: 1500, description: "Permissão veterinária USDA para produtos de origem animal." },
  { category: "Cosméticos", name: "Registro Estabelecimento FDA (Cosméticos)", price: 595, description: "Registro FDA para estabelecimentos produtores de cosméticos." },
  { category: "Cosméticos", name: "Registro por produto (Cosméticos)", price: 195, description: "Registro individual de cada produto cosmético na FDA." },
  { category: "Cosméticos", name: "Revisão de rótulos (1º rótulo) — Cosméticos", price: 595, description: "Revisão do primeiro rótulo para cosméticos conforme FDA." },
  { category: "Cosméticos", name: "Revisão de rótulos (rótulos adicionais) — Cosméticos", price: 185, description: "Revisão de rótulo adicional para cosméticos." },
  { category: "Medicamentos", name: "Registro Estabelecimento FDA (Medicamentos)", price: 595, description: "Registro FDA para estabelecimentos farmacêuticos." },
  { category: "Medicamentos", name: "Registro por produto (Medicamentos)", price: 195, description: "Registro individual de cada medicamento ou suplemento na FDA." },
  { category: "Medicamentos", name: "Revisão de rótulos (1º rótulo) — Medicamentos", price: 595, description: "Revisão do primeiro rótulo para medicamentos conforme FDA." },
  { category: "Medicamentos", name: "Revisão de rótulos (rótulos adicionais) — Medicamentos", price: 185, description: "Revisão de rótulo adicional para medicamentos." },
  { category: "Medical Devices", name: "Registro Estabelecimento FDA (Medical Devices)", price: 595, description: "Registro FDA para fabricantes e distribuidores de dispositivos médicos." },
  { category: "Medical Devices", name: "Registro por produto (Medical Device)", price: 195, description: "Registro individual de cada dispositivo médico na FDA." },
  { category: "Medical Devices", name: "Revisão de rótulos (1º rótulo) — Medical Devices", price: 595, description: "Revisão do primeiro rótulo para devices conforme FDA." },
  { category: "Medical Devices", name: "Revisão de rótulos (rótulos adicionais) — Medical Devices", price: 185, description: "Revisão de rótulo adicional para medical devices." },
  { category: "Abertura de Empresa", name: "Registro de Empresa LLC em Miami", price: 1100, description: "Constituição completa de LLC em Miami, Flórida." },
  { category: "Abertura de Empresa", name: "Operating Agreement", price: 450, description: "Redação do acordo operacional para sua LLC." },
  { category: "NOAA & US Fisheries", name: "NOAA Fisheries", price: 1500, description: "Registro na NOAA para produtos pesqueiros exportados aos EUA." },
  { category: "NOAA & US Fisheries", name: "USFWS (US Fish & Wildlife Service)", price: 950, description: "Permissão do US Fish & Wildlife Service para produtos de fauna silvestre." },
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Pacote Básico (LLC obrigatória)", price: 2000, description: "Registro de marca no USPTO — Pacote Básico. Requer LLC." },
  { category: "Registro de Marca USPTO", name: "Registro de Marca — Pacote Premium (LLC obrigatória)", price: 3000, description: "Registro de marca no USPTO com cobertura ampliada. Requer LLC." },
  { category: "Cursos", name: "Boas Práticas de Fabricação (BPF)", price: 299, description: "Alimentos, suplementos alimentares, cosméticos e medicamentos." },
  { category: "Outros", name: "US Agent Inbox (Mensalidade)", price: 99, description: "Serviço mensal de US Agent Inbox para notificações da FDA." },
];

export const CATALOGS: Record<"es" | "en" | "pt", Service[]> = {
  es: CATALOG_ES,
  en: CATALOG_EN,
  pt: CATALOG_PT,
};

export const CAT_COLORS: Record<string, string> = {
  "Alimentos y Bebidas": "#6366F1", "Food & Beverage": "#6366F1", "Alimentos e Bebidas": "#6366F1",
  "Bebidas Alcohólicas": "#A855F7", "Alcoholic Beverages": "#A855F7", "Bebidas Alcoólicas": "#A855F7",
  "USDA": "#22C55E",
  "Cosméticos": "#F43F5E", "Cosmetics": "#F43F5E",
  "Medicamentos": "#3B82F6", "Pharmaceuticals": "#3B82F6",
  "Medical Devices": "#0EA5E9",
  "Apertura de Empresa": "#F59E0B", "Company Formation": "#F59E0B", "Abertura de Empresa": "#F59E0B",
  "NOAA & US Fisheries": "#14B8A6",
  "Registro de Marca USPTO": "#D97706", "USPTO Trademark": "#D97706",
  "Cursos": "#8B5CF6", "Courses": "#8B5CF6",
  "Otros": "#64748B", "Other": "#64748B", "Outros": "#64748B",
};

// Remap selected services to another language by index position.
// Custom services (not found in any catalog) are left untouched.
// Keeps edited price/qty, only swaps name and description.
export function remapServices<T extends { name: string; description: string }>(
  selected: T[],
  newLang: "es" | "en" | "pt"
): T[] {
  const target = CATALOGS[newLang];
  return selected.map(sel => {
    for (const cat of [CATALOG_ES, CATALOG_EN, CATALOG_PT]) {
      const idx = cat.findIndex(s => s.name === sel.name);
      if (idx !== -1) {
        return { ...sel, name: target[idx].name, description: target[idx].description };
      }
    }
    return sel;
  });
}

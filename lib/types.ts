export interface Workspace {
  id: string;
  owner_id: string;
  nombre_taller: string;
  whatsapp: string;
  country_code: string;
  currency_code: string;
  tax_rate_pct: number;
  trial_ends_at: string;
  subscription_status: string;
  mp_conectado: boolean;
}

export const WORKSPACE_COLUMNS =
  "id, owner_id, nombre_taller, whatsapp, country_code, currency_code, tax_rate_pct, trial_ends_at, subscription_status, mp_conectado";

export const CATEGORIAS = ["blanco", "estampado", "tinta_papel", "empaque", "otro"] as const;
export const UNIDADES = ["unidad", "cm", "ml", "hoja", "minuto"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type Unidad = (typeof UNIDADES)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  blanco: "Blanco (tazón, polera…)",
  estampado: "Estampado (DTF, vinilo)",
  tinta_papel: "Tinta y papel",
  empaque: "Empaque",
  otro: "Otro",
};

export interface Insumo {
  id: string;
  workspace_id: string;
  nombre: string;
  categoria: Categoria;
  unidad_medida: Unidad;
  costo_unitario: number;
  stock_actual: number;
  updated_at: string;
}

export interface Producto {
  id: string;
  workspace_id: string;
  nombre: string;
  merma_pct: number;
  mano_obra_fija: number;
  gastos_fijos_prorrateo: number;
  margen_objetivo_pct: number;
  aplica_iva: boolean;
  precio_sugerido: number | null;
  created_at: string;
}

export interface ProductoConReceta extends Producto {
  producto_insumos: { id: string; insumo_id: string; cantidad_requerida: number; insumos: Pick<Insumo, "id" | "nombre" | "costo_unitario" | "unidad_medida"> | null }[];
}

export type CotizacionEstado = "borrador" | "enviada" | "abonada" | "cancelada";

export interface CotizacionResumen {
  id: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  total: number;
  abono_requerido: number;
  abono_porcentaje: number;
  estado: CotizacionEstado;
  slug_publico: string;
  created_at: string;
}

export interface CotizacionPublica {
  slug: string;
  cliente_nombre: string;
  items: { nombre: string; cantidad: number; precio_unitario: number; subtotal: number }[];
  total: number;
  abono_porcentaje: number;
  abono_requerido: number;
  plazo_entrega_dias: number;
  notas_personalizacion: string | null;
  estado: CotizacionEstado;
  created_at: string;
  taller: { nombre_taller: string; whatsapp: string; country_code: string; currency_code: string; mp_conectado: boolean };
}

export interface Plantilla {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  publicar_desde: string | null;
  publicar_hasta: string | null;
  solo_pro: boolean;
}

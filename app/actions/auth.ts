"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { PHONE_PREFIXES } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";

const prefixes = PHONE_PREFIXES.map((p) => p.prefix);

const registroSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  nombre_taller: z.string().trim().min(2, "Ingresa el nombre del taller").max(80),
  prefix: z.string().refine((p) => prefixes.includes(p), "Prefijo no soportado"),
  telefono: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(8, "WhatsApp inválido").max(11, "WhatsApp inválido")),
});

export async function registro(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registroSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { email, password, nombre_taller, prefix, telefono } = parsed.data;

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { nombre_taller, whatsapp: `${prefix}${telefono}` },
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Te enviamos un correo para confirmar tu cuenta. Revísalo y vuelve a ingresar." };
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o contraseña incorrectos" };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

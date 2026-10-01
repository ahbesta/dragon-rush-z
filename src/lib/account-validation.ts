import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const profileNameSchema = z
  .string()
  .trim()
  .min(2, "O nome deve ter entre 2 e 60 caracteres.")
  .max(60, "O nome deve ter entre 2 e 60 caracteres.")
  .refine(
    (name) =>
      Array.from(name).every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    "O nome contém caracteres inválidos.",
  );

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "A nova senha deve ter pelo menos 8 caracteres.")
      .max(PASSWORD_MAX_LENGTH, "A nova senha deve ter no máximo 128 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "A confirmação não corresponde à nova senha.",
    path: ["confirmPassword"],
  });

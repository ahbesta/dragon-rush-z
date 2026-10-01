import { describe, expect, it } from "vitest";
import { passwordChangeSchema, profileNameSchema } from "@/lib/account-validation";

describe("Edição de perfil", () => {
  it("normaliza o nome preservando acentos e espaços internos", () => {
    expect(profileNameSchema.parse("  Rafael José  ")).toBe("Rafael José");
    expect(profileNameSchema.parse("悟空")).toBe("悟空");
  });
  it("recusa nomes vazios, longos ou com caracteres de controle", () => {
    for (const name of [
      " ",
      "A",
      "A".repeat(61),
      "Rafa\nTeste",
      "Rafa\u0000Teste",
      "Rafa\u007fTeste",
    ]) {
      expect(profileNameSchema.safeParse(name).success).toBe(false);
    }
    expect(profileNameSchema.safeParse("A".repeat(60)).success).toBe(true);
  });
});
describe("Troca de senha", () => {
  const valid = {
    currentPassword: "Atual123!",
    newPassword: "Nova123!",
    confirmPassword: "Nova123!",
  };
  it("exige senha atual, limites de tamanho e confirmação", () => {
    expect(passwordChangeSchema.safeParse(valid).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ ...valid, currentPassword: "" }).success).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ ...valid, confirmPassword: "Diferente123!" }).success,
    ).toBe(false);
    for (const length of [7, 129]) {
      const password = "a".repeat(length);
      expect(
        passwordChangeSchema.safeParse({
          ...valid,
          newPassword: password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
    }
    const password = "a".repeat(128);
    expect(
      passwordChangeSchema.safeParse({ ...valid, newPassword: password, confirmPassword: password })
        .success,
    ).toBe(true);
  });
  it("não remove espaços de senhas", () => {
    const password = " senha com espaços ";
    expect(
      passwordChangeSchema.parse({ ...valid, newPassword: password, confirmPassword: password })
        .newPassword,
    ).toBe(password);
  });
});

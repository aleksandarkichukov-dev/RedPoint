"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, loginCustomer, registerCustomer } from "@/lib/customer";

/**
 * Logging in, registering and out, as server actions.
 *
 * Validated here and not only in the browser, for the same reason checkout is:
 * a shopper with JavaScript off, or a slow network that submits before the
 * form has hydrated, still gets a sensible answer instead of a blank failure.
 */

export interface AccountState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Long enough to be worth having, short enough that nobody gives up. */
const MIN_PASSWORD = 8;

export async function loginAction(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Въведете имейл и парола." };
  }

  const result = await loginCustomer(email, password);
  if (!result.ok) return { error: result.message };

  redirect("/account");
}

export async function registerAction(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const value = (key: string) => String(formData.get(key) ?? "").trim();

  const fields = {
    email: value("email"),
    firstName: value("firstName"),
    lastName: value("lastName"),
  };
  const password = String(formData.get("password") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!fields.firstName) fieldErrors.firstName = "Въведете име.";
  if (!fields.lastName) fieldErrors.lastName = "Въведете фамилия.";
  if (!fields.email) fieldErrors.email = "Въведете имейл.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
    fieldErrors.email = "Имейлът не изглежда валиден.";
  }
  if (!password) fieldErrors.password = "Въведете парола.";
  else if (password.length < MIN_PASSWORD) {
    fieldErrors.password = `Паролата трябва да е поне ${MIN_PASSWORD} знака.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const result = await registerCustomer({ ...fields, password });
  if (!result.ok) return { error: result.message };

  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  /* The header shows a name when somebody is logged in, and it is rendered on
     the server — without this it keeps showing the old one until something
     else happens to re-render. */
  revalidatePath("/", "layout");
  redirect("/");
}

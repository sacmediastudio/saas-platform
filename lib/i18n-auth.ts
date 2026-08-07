export type Lang = "en" | "es";

const STORAGE_KEY = "zertoo_lang";

/** Lee el idioma guardado por el selector de la landing. Si nunca se
 * eligió nada, cae al inglés — mismo default que la landing. */
export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "es" ? "es" : "en";
}

export function setStoredLang(lang: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, lang);
}

export const authTranslations = {
  en: {
    login: {
      title: "Log in",
      email: "name@email.com",
      password: "Password",
      submit: "Log in",
      submitting: "Logging in...",
      noAccount: "Don't have an account?",
      signUpLink: "Sign up",
    },
    signup: {
      title: "Create your account",
      subtitle: "7-day free trial, no credit card",
      businessTypes: { RESTAURANT: "Restaurant", SMALL_BUSINESS: "Service business", SMARTLINK: "Smartlink" },
      businessName: "Business name",
      yourName: "Your name",
      email: "name@email.com",
      password: "Password (min. 8 characters)",
      submit: "Create account",
      submitting: "Creating account...",
      haveAccount: "Already have an account?",
      loginLink: "Log in",
    },
    verify: {
      title: "Verify your email",
      subtitle: "We sent you a 6-digit code. Enter it here to activate your account.",
      submit: "Verify",
      submitting: "Verifying...",
      resend: "Resend code",
      resending: "Sending...",
      resent: "We sent you a new code.",
    },
    errors: {
      generic: "Something went wrong",
      networkError: "Could not connect to the server. Please try again.",
      invalidCredentials: "Incorrect email or password",
      accountExists: "That email is already registered",
      invalidData: "Invalid data",
    },
  },
  es: {
    login: {
      title: "Inicia sesión",
      email: "name@correo.com",
      password: "Contraseña",
      submit: "Entrar",
      submitting: "Entrando...",
      noAccount: "¿No tienes cuenta?",
      signUpLink: "Regístrate",
    },
    signup: {
      title: "Crea tu cuenta",
      subtitle: "7 días gratis, sin tarjeta",
      businessTypes: { RESTAURANT: "Restaurante", SMALL_BUSINESS: "Negocio de servicios", SMARTLINK: "Smartlink" },
      businessName: "Nombre del negocio",
      yourName: "Tu nombre",
      email: "name@correo.com",
      password: "Contraseña (mínimo 8 caracteres)",
      submit: "Crear cuenta",
      submitting: "Creando cuenta...",
      haveAccount: "¿Ya tienes cuenta?",
      loginLink: "Inicia sesión",
    },
    verify: {
      title: "Verifica tu correo",
      subtitle: "Te enviamos un código de 6 dígitos. Ingrésalo aquí para activar tu cuenta.",
      submit: "Verificar",
      submitting: "Verificando...",
      resend: "Reenviar código",
      resending: "Enviando...",
      resent: "Te enviamos un nuevo código.",
    },
    errors: {
      generic: "Algo salió mal",
      networkError: "No se pudo conectar con el servidor. Intenta de nuevo.",
      invalidCredentials: "Correo o contraseña incorrectos",
      accountExists: "Ese correo ya está registrado",
      invalidData: "Datos inválidos",
    },
  },
};

/**
 * Nuestra propia API devuelve mensajes de error en español (los
 * escribimos nosotros). Para no tener que traducir el backend entero,
 * mapeamos los mensajes conocidos al idioma actual; cualquier mensaje
 * que no reconozcamos se muestra tal cual (mejor eso que ocultarlo).
 */
export function translateApiError(message: string, lang: Lang): string {
  if (lang === "es") return message;
  const map: Record<string, string> = {
    "Correo o contraseña incorrectos": "Incorrect email or password",
    "Ese correo ya está registrado": "That email is already registered",
    "Datos inválidos": "Invalid data",
    "No se pudo crear la cuenta": "Could not create the account",
    "No se pudo iniciar sesión": "Could not log in",
  };
  return map[message] ?? message;
}

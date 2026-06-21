import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { useState, useEffect } from "react";
import MuhakkimProV4 from "./MuhakkimProV4";
import { QUOTA_EVENT } from "./lib/aiQuota";

// REQUIRED — resolves the key from window.location.hostname so the same build
// serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// Empty in dev (Clerk hits dev FAPI directly), auto-set in prod. Do not gate.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's setLocation
// prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

const GOLD = "#b45309";
const NAVY = "#1e293b";

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: GOLD,
    colorForeground: NAVY,
    colorMutedForeground: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: NAVY,
    colorNeutral: "#cbd5e1",
    fontFamily: "Tajawal, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-slate-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-extrabold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButton: "border-slate-300",
    socialButtonsBlockButtonText: "text-slate-700 font-semibold",
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-400",
    formFieldLabel: "text-slate-700 font-semibold",
    formFieldInput: "bg-white text-slate-900 border-slate-300",
    formButtonPrimary:
      "bg-[#b45309] hover:bg-[#92400e] text-white font-bold normal-case",
    footerActionText: "text-slate-500",
    footerActionLink: "text-[#b45309] font-bold hover:text-[#92400e]",
    identityPreviewEditButton: "text-[#b45309]",
    formFieldSuccessText: "text-emerald-600",
    otpCodeFieldInput: "text-slate-900 border-slate-300",
    logoBox: "h-12",
    logoImage: "h-12 w-12",
  },
};

const clerkLocalization = {
  ...arSA,
  signIn: {
    ...arSA.signIn,
    start: {
      ...arSA.signIn?.start,
      title: "مرحبًا بعودتك",
      subtitle: "سجّل الدخول للوصول إلى أدوات محكّم برو",
    },
  },
  signUp: {
    ...arSA.signUp,
    start: {
      ...arSA.signUp?.start,
      title: "أنشئ حسابك",
      subtitle: "ابدأ مع منصة محكّم برو الآن",
    },
  },
};

function SignInPage() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4"
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div
      dir="rtl"
      className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4"
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={basePath || "/"}
      />
    </div>
  );
}

// Auth control injected into the Muhakkim header. Shows a sign-in button when
// signed out, and the user's initial + sign-out when signed in.
function AuthControl() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const btnBase: React.CSSProperties = {
    fontFamily: "inherit",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 8,
    border: "none",
  };

  const initial =
    user?.firstName?.[0] ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "?";

  return (
    <>
      <Show when="signed-out">
        <button
          onClick={() => setLocation("/sign-in")}
          style={{
            ...btnBase,
            background: GOLD,
            color: "#fff",
            padding: "6px 14px",
            boxShadow: `0 2px 8px ${GOLD}55`,
          }}
        >
          تسجيل الدخول
        </button>
      </Show>
      <Show when="signed-in">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            title={user?.primaryEmailAddress?.emailAddress || ""}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: NAVY,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            style={{
              ...btnBase,
              background: "transparent",
              color: GOLD,
              border: `1px solid ${GOLD}55`,
              padding: "5px 10px",
            }}
          >
            خروج
          </button>
        </div>
      </Show>
    </>
  );
}

function HomeApp() {
  return <MuhakkimProV4 authSlot={<AuthControl />} />;
}

type QuotaDetail = {
  status: number;
  code?: string;
  error?: string;
  limit?: number;
};

// Single global modal triggered by the AI fetch interceptor (lib/aiQuota).
// Shows a sign-in prompt (401) or an upgrade prompt (402) for any blocked AI
// call, without touching the vendored tool suite.
function QuotaGate() {
  const [, setLocation] = useLocation();
  const [detail, setDetail] = useState<QuotaDetail | null>(null);

  useEffect(() => {
    function onQuota(e: Event) {
      setDetail((e as CustomEvent<QuotaDetail>).detail);
    }
    window.addEventListener(QUOTA_EVENT, onQuota);
    return () => window.removeEventListener(QUOTA_EVENT, onQuota);
  }, []);

  if (!detail) return null;

  const isAuth = detail.code === "auth_required" || detail.status === 401;
  const title = isAuth ? "تسجيل الدخول مطلوب" : "بلغت الحد المجاني";
  const message =
    detail.error ||
    (isAuth
      ? "يجب تسجيل الدخول لاستخدام أدوات الذكاء الاصطناعي."
      : "لقد بلغت الحد الشهري المجاني. الرجاء ترقية باقتك للمتابعة.");
  const ctaLabel = isAuth ? "تسجيل الدخول" : "عرض الباقات";

  function close() {
    setDetail(null);
  }

  function onCta() {
    close();
    setLocation(isAuth ? "/sign-in" : "/");
  }

  return (
    <div
      dir="rtl"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Tajawal, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          width: 420,
          maxWidth: "100%",
          padding: "28px 26px",
          boxShadow: "0 24px 60px rgba(15,23,42,0.35)",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: `${GOLD}1a`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          {isAuth ? "🔐" : "⭐"}
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            color: NAVY,
            fontWeight: 800,
            fontSize: 20,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: "0 0 22px",
            color: "#475569",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onCta}
            style={{
              flex: 1,
              background: GOLD,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 18px",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 14px ${GOLD}55`,
            }}
          >
            {ctaLabel}
          </button>
          <button
            onClick={close}
            style={{
              background: "transparent",
              color: "#64748b",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "11px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/" component={HomeApp} />
        <Route component={HomeApp} />
      </Switch>
      <QuotaGate />
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
